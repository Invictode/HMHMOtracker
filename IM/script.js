// --- Use the SAME Firebase config as your other trackers ---
const firebaseConfig = {
    apiKey: "AIzaSyC4gBqQlYh3vQ2wbfySpG-4z6Dk4dJ5hoc",
    authDomain: "er-handover-c245b.firebaseapp.com",
    projectId: "er-handover-c245b",
    storageBucket: "er-handover-c245b.appspot.com",
    messagingSenderId: "867309153832",
    appId: "1:867309153832:web:a3a915736ac98709080f1d",
    measurementId: "G-0TGFDX9CWN"
};

// --- INITIALIZE FIREBASE ---
let db, auth;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
} catch (e) { console.error("Firebase initialization failed.", e); }

// --- AUTHENTICATION CHECK ---
auth.onAuthStateChanged(user => {
    if (user) {
        initializeApp();
    } else {
        window.location.href = '../login.html';
    }
});

// --- GLOBAL APP STATE & CONFIG ---
const wardsConfig = [
    { name: "Medical Ward", totalBeds: 11, beds: ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21"] },
    { name: "Surgical Ward", totalBeds: 0, beds: [] },
    { name: "Private Ward", totalBeds: 0, beds: [] },
    { name: "ICU", totalBeds: 0, beds: [] }
];
let allData = { active: [], discharged: [], transferred: [], lama: [] };
let statsCurrentDate = new Date();

// --- MAIN APP FUNCTION ---
function initializeApp() {
    // --- DOM ELEMENT REFERENCES ---
    const wardBoardContainer = document.getElementById('ward-board-view');
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal'), bedTransfer: document.getElementById('bed-transfer-modal') };
    const forms = { patient: document.getElementById('patient-form'), hospitalTransfer: document.getElementById('hospital-transfer-form'), bedTransfer: document.getElementById('bed-transfer-form') };
    const signOutBtn = document.getElementById('sign-out-btn');
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    const views = { board: document.getElementById('ward-board-view'), discharged: document.getElementById('discharged-view'), transferred: document.getElementById('transferred-view'), lama: document.getElementById('lama-view'), stats: document.getElementById('stats-view') };
    const tableBodies = { discharged: document.getElementById('discharged-table-body'), transferred: document.getElementById('transferred-table-body'), lama: document.getElementById('lama-table-body'), };
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lama: document.getElementById('search-lama'), };
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display'), };
    const statsElements = {
        occupied: document.getElementById('stats-occupied'),
        vacant: document.getElementById('stats-vacant'),
        s1Total: document.getElementById('stats-s1-total'),
        s2Total: document.getElementById('stats-s2-total'),
        s3Total: document.getElementById('stats-s3-total'),
    };

    // --- HELPER & LOGIC FUNCTIONS ---
    const showView = (viewName) => {
        if (viewName === 'stats') { updateStatsForDate(); }
        Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
        Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
        if (views[viewName]) { views[viewName].style.display = 'block'; if (viewName === 'board') views[viewName].style.display = 'flex'; }
        if (navButtons[viewName]) navButtons[viewName].classList.add('active');
    };

    const closeModal = (modalName) => { if (modals[modalName]) modals[modalName].style.display = 'none'; };
    
    const openPatientModal = (patient, wardName) => {
        const form = forms.patient;
        form.reset();
        document.getElementById('modal-title').textContent = patient ? `Edit Patient in Bed ${patient.bedNumber}` : "Admit New Patient";
        const bedTransferBtn = document.getElementById('bed-transfer-btn');
        if (patient) {
            form.elements['patient-id-input'].value = patient.id;
            form.elements['ward-name-input'].value = patient.ward;
            form.elements['bed-number'].value = patient.bedNumber;
            form.elements['patient-name'].value = patient.patientName;
            form.elements['patient-age'].value = patient.age;
            form.elements['patient-sex'].value = patient.sex;
            form.elements['hospital-number'].value = patient.hospitalNumber || '';
            form.elements['id-card-number'].value = patient.idCardNumber || '';
            form.elements['allergies'].value = patient.allergies || '';
            form.elements['comorbidities'].value = patient.comorbidities || '';
            form.elements['short-history'].value = patient.shortHistory || '';
            form.elements['diagnosis'].value = patient.diagnosis;
            form.elements['ongoing-management'].value = patient.ongoingManagement || '';
            form.elements['significant-events'].value = ''; 
            form.elements['plan'].value = patient.plan;
            bedTransferBtn.style.display = 'inline-block';
            bedTransferBtn.onclick = () => openBedTransferModal(patient);
        } else {
            form.elements['patient-id-input'].value = '';
            form.elements['ward-name-input'].value = wardName;
            bedTransferBtn.style.display = 'none';
        }
        modals.patient.style.display = 'block';
    };

    const openActionsModal = (patient) => { document.getElementById('actions-patient-name').textContent = patient.patientName; modals.actions.dataset.patientId = patient.id; modals.actions.style.display = 'block'; };
    const openHospitalTransferModal = (patient) => { document.getElementById('hospital-transfer-patient-name').textContent = patient.patientName; forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value = patient.id; closeModal('actions'); modals.hospitalTransfer.style.display = 'block'; };
    const openBedTransferModal = (patient) => { document.getElementById('bed-transfer-patient-name').textContent = patient.patientName; forms.bedTransfer.elements['bed-transfer-patient-id'].value = patient.id; forms.bedTransfer.elements['transfer-ward-select'].value = patient.ward; forms.bedTransfer.elements['transfer-bed-number'].value = patient.bedNumber; closeModal('patient'); modals.bedTransfer.style.display = 'block'; };
    const archiveAndRemove = (patient, collectionName, additionalData) => { if (patient) { db.collection(collectionName).add({ ...patient, ...additionalData }).then(() => db.collection('ward_patients').doc(patient.id).delete()); } };
    const handleDischargeAction = (action, patient) => { switch (action) { case 'discharge-home': if (confirm(`Confirm discharge for ${patient.patientName}?`)) { archiveAndRemove(patient, 'ward_discharged', { dischargeTime: new Date().toISOString() }); closeModal('actions'); } break; case 'transfer': openHospitalTransferModal(patient); break; case 'lama': if (confirm("Confirm LAMA?")) { archiveAndRemove(patient, 'ward_lama_dor', { status: 'LAMA', eventTime: new Date().toISOString() }); closeModal('actions'); } break; case 'dor': if (confirm("Confirm DOR?")) { archiveAndRemove(patient, 'ward_lama_dor', { status: 'DOR', eventTime: new Date().toISOString() }); closeModal('actions'); } break; } };
    const handleCopy = (button) => { const textToCopy = button.dataset.copy; navigator.clipboard.writeText(textToCopy).then(() => { button.textContent = 'Copied!'; button.classList.add('copied'); setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('copied'); }, 1500); }); };
    const saveOccupancyToLocalStorage = (departmentId) => {
        const medicalWard = wardsConfig.find(w => w.name === "Medical Ward");
        if (!medicalWard) return;
        const occupiedCount = allData.active.filter(p => p.ward === "Medical Ward").length;
        const today = new Date();
        const dateString = today.toISOString().slice(0, 10);
        const storageKey = `hmhmo_${departmentId}_history`;
        let departmentHistory = JSON.parse(localStorage.getItem(storageKey) || '{}');
        departmentHistory[dateString] = occupiedCount;
        localStorage.setItem(storageKey, JSON.stringify(departmentHistory));
        console.log(`${departmentId} history updated for ${dateString}: ${occupiedCount} beds`);
    };

    // --- RENDER FUNCTIONS ---
    const renderWards = () => {
        wardBoardContainer.innerHTML = '';
        wardsConfig.forEach(wardInfo => {
            const wardName = wardInfo.name;
            const occupiedBeds = allData.active.filter(p => p.ward === wardName).length;
            const freeBeds = wardInfo.totalBeds > 0 ? wardInfo.totalBeds - occupiedBeds : 'N/A';
            let occupancyHTML = '';
            if (wardInfo.totalBeds > 0) { occupancyHTML = `<span class="ward-occupancy">Occupied: <strong>${occupiedBeds}</strong> | Free: <strong>${freeBeds}</strong></span>`; }
            const wardSection = document.createElement('div');
            wardSection.className = 'ward-section';
            wardSection.innerHTML = `<div class="ward-header"><h2>${wardName}</h2>${occupancyHTML}<button class="admit-btn" data-ward="${wardName}"><i class="fa-solid fa-user-plus"></i> Admit New Patient</button></div><div class="bed-grid" id="grid-${wardName.replace(/\s+/g, '-')}"></div>`;
            wardBoardContainer.appendChild(wardSection);
        });
        renderAllPatients();
    };

    const renderAllPatients = () => {
        document.querySelectorAll('.bed-grid').forEach(grid => grid.innerHTML = '');
        wardsConfig.forEach(wardInfo => {
            const wardPatients = allData.active.filter(p => p.ward === wardInfo.name);
            const gridId = `grid-${wardInfo.name.replace(/\s+/g, '-')}`;
            const patientGrid = document.getElementById(gridId);
            
            if (patientGrid) {
                const allBedsInWard = new Set(wardInfo.beds);
                wardPatients.forEach(p => allBedsInWard.add(p.bedNumber));
                
                if (allBedsInWard.size === 0) {
                    patientGrid.innerHTML = `<p class="empty-ward-message">No patients in this ward.</p>`;
                    return;
                }
                const sortedBeds = [...allBedsInWard].sort((a,b) => (parseInt(a.match(/\d+/)) || 0) - (parseInt(b.match(/\d+/)) || 0));
                sortedBeds.forEach(bedNumber => {
                    const patient = wardPatients.find(p => p.bedNumber === bedNumber);
                    renderPatientCard(patientGrid, patient, bedNumber);
                });
            }
        });
        saveOccupancyToLocalStorage('IM');
    };

    const renderPatientCard = (grid, patient, bedNumber) => {
        const card = document.createElement('div');
        card.className = `patient-card ${patient ? '' : 'vacant'}`;
        if (patient) {
            card.dataset.id = patient.id;
            const allergyHtml = patient.allergies ? `<p class="allergy-info"><strong>Allergies:</strong> ${patient.allergies}</p>` : '';
            card.innerHTML = `
                <div class="patient-card-header">
                    <span class="bed-number">Bed: ${patient.bedNumber}</span>
                    <span class="patient-name">${patient.patientName}</span>
                </div>
                <div class="patient-info">
                    <p><span class="info-label">Age/Sex:</span> <span class="info-value">${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</span></p>
                    <p><span class="info-label">Hospital #:</span> <span class="info-value">${patient.hospitalNumber || 'N/A'}<button class="copy-btn" data-copy="${patient.hospitalNumber||''}">Copy</button></span></p>
                    <p><span class="info-label">ID Card #:</span> <span class="info-value">${patient.idCardNumber || 'N/A'}<button class="copy-btn" data-copy="${patient.idCardNumber||''}">Copy</button></span></p>
                    <p><span class="info-label">Adm. Date:</span> <span class="info-value">${new Date(patient.admissionDate).toLocaleDateString()}</span></p>
                    <p><span class="info-label">Comorbidities:</span> <span class="info-value">${patient.comorbidities || 'N/A'}</span></p>
                    ${allergyHtml}
                    <p><span class="info-label">Diagnosis:</span> <span class="info-value">${patient.diagnosis || 'N/A'}</span></p>
                    <p><span class="info-label">Ongoing Mgt:</span> <span class="info-value">${patient.ongoingManagement || 'N/A'}</span></p>
                    <p><span class="info-label">Plan:</span> <span class="info-value">${patient.plan || 'N/A'}</span></p>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn edit" data-action="edit"><i class="fa-solid fa-pen-to-square"></i> Details</button>
                    <button class="card-action-btn discharge" data-action="discharge"><i class="fa-solid fa-right-from-bracket"></i> Actions</button>
                </div>`;
        } else {
            card.innerHTML = `<div class="patient-card-header"><span class="bed-number">Bed: ${bedNumber}</span></div><div class="vacant-message">Vacant</div>`;
        }
        grid.appendChild(card);
    };
    
    const renderList = (key) => {
        const tbody = tableBodies[key];
        const items = allData[key];
        const getRowRenderer = (rendererKey) => { const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A'; switch(rendererKey) { case 'discharged': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`; case 'transferred': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.transferredTo}</td><td>${formatTime(item.transferTime)}</td>`; case 'lama': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td>`; default: return () => ''; } };
        const renderRowFunc = getRowRenderer(key);
        const searchTerm = (searchBars[key] ? searchBars[key].value : "").toLowerCase();
        if (!tbody || !items || !renderRowFunc) return;
        const filteredItems = items.filter(item => (item.patientName && item.patientName.toLowerCase().includes(searchTerm)));
        tbody.innerHTML = '';
        
        const timeField = { discharged: 'dischargeTime', transferred: 'transferTime', lama: 'eventTime' }[key];
        if (!timeField) { 
            if (filteredItems.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="empty-ward-message">No patients.</td></tr>`; } else { filteredItems.forEach(item => { const row = document.createElement('tr'); row.innerHTML = renderRowFunc(item); tbody.appendChild(row); }); }
            return;
        }
        
        const { shifts, olderItems } = groupDataByShift(filteredItems, timeField);
        const colspan = tbody.parentElement.querySelector('thead tr').childElementCount;

        Object.values(shifts).reverse().forEach(shift => {
            if (shift.items.length > 0) {
                const headerRow = tbody.insertRow();
                headerRow.className = 'shift-header-row';
                headerRow.innerHTML = `<td colspan="${colspan}">${shift.name}</td>`;
                shift.items.forEach(item => { const row = tbody.insertRow(); row.innerHTML = renderRowFunc(item); });
            }
        });

        if (olderItems.length > 0) {
            const headerRow = tbody.insertRow();
            headerRow.className = 'shift-header-row';
            headerRow.innerHTML = `<td colspan="${colspan}">Previous Days</td>`;
            olderItems.forEach(item => { const row = tbody.insertRow(); row.innerHTML = renderRowFunc(item); });
        }
        
        if (tbody.innerHTML === '') {
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-ward-message">${searchTerm ? 'No matching patients found.' : 'No patients in this list.'}</td></tr>`;
        }
    };

    const groupDataByShift = (items, timeField) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const shifts = { shift1: { name: 'Shift 1 (8am - 4pm)', start: new Date(today.getTime() + 8 * 3600000), end: new Date(today.getTime() + 16 * 3600000), items: [] }, shift2: { name: 'Shift 2 (4pm - 12am)', start: new Date(today.getTime() + 16 * 3600000), end: new Date(today.getTime() + 24 * 3600000), items: [] }, shift3: { name: 'Shift 3 (12am - 8am)', start: today, end: new Date(today.getTime() + 8 * 3600000), items: [] }, };
        const todayItems = items.filter(item => new Date(item[timeField]) >= today);
        const olderItems = items.filter(item => new Date(item[timeField]) < today);
        todayItems.forEach(item => { const itemTime = new Date(item[timeField]); if (itemTime >= shifts.shift1.start && itemTime < shifts.shift2.start) shifts.shift1.items.push(item); else if (itemTime >= shifts.shift2.start && itemTime < shifts.shift2.end) shifts.shift2.items.push(item); else if (itemTime >= shifts.shift3.start && itemTime < shifts.shift1.start) shifts.shift3.items.push(item); });
        return { shifts, olderItems };
    };

    const updateStatsForDate = () => {
        const date = statsCurrentDate;
        
        // --- 1. Update Date Display ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        if (date.getTime() === today.getTime()) {
            statsNav.dateDisplay.textContent = 'Today';
        } else {
            statsNav.dateDisplay.textContent = date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        
        // --- 2. Calculate Occupancy ---
        const medicalWardConfig = wardsConfig.find(w => w.name === "Medical Ward");
        if (medicalWardConfig) {
            const occupiedCount = allData.active.filter(p => p.ward === "Medical Ward").length;
            const vacantCount = medicalWardConfig.totalBeds - occupiedCount;
            statsElements.occupied.textContent = occupiedCount;
            statsElements.vacant.textContent = vacantCount >= 0 ? vacantCount : 0;
        }

        // --- 3. Calculate Shift Totals ---
        const shiftCounts = { s1: 0, s2: 0, s3: 0 };
        const dayStart = new Date(date.getTime());
        const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

        const s1_start = new Date(date.getTime() + 8 * 3600000);
        const s2_start = new Date(date.getTime() + 16 * 3600000);
        const s3_start = new Date(date.getTime()); 
        
        const checkShift = (time) => {
            if (time >= s1_start && time < s2_start) return 's1';
            if (time >= s2_start && time < dayEnd) return 's2';
            if (time >= s3_start && time < s1_start) return 's3';
            return null;
        };
        
        const processCollection = (collection, timeField) => {
            collection.forEach(item => {
                const eventTime = new Date(item[timeField]);
                if (eventTime >= dayStart && eventTime < dayEnd) {
                    const shift = checkShift(eventTime);
                    if (shift) shiftCounts[shift]++;
                }
            });
        };
        
        processCollection(allData.active, 'admissionDate');
        processCollection(allData.discharged, 'dischargeTime');
        processCollection(allData.transferred, 'transferTime');
        processCollection(allData.lama, 'eventTime');

        statsElements.s1Total.textContent = shiftCounts.s1;
        statsElements.s2Total.textContent = shiftCounts.s2;
        statsElements.s3Total.textContent = shiftCounts.s3;
    };
    
    // --- REALTIME LISTENERS ---
    const setupRealtimeListeners = () => {
        const createListener = (collection, orderField, key) => {
            db.collection(collection).orderBy(orderField, 'desc').onSnapshot(snapshot => {
                allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderList(key);
                updateStatsForDate();
            });
        };
        db.collection('ward_patients').orderBy('ward').orderBy('bedNumber').onSnapshot(snapshot => {
            allData.active = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderWards();
            updateStatsForDate();
        }, err => { console.error("FirebaseError: This query likely needs a composite index.", err); });
        createListener('ward_discharged', 'dischargeTime', 'discharged');
        createListener('ward_transferred', 'transferTime', 'transferred');
        createListener('ward_lama_dor', 'eventTime', 'lama');
    };

    // --- EVENT LISTENER SETUP & INITIAL CALLS ---
    wardBoardContainer.addEventListener('click', e => { if (e.target.classList.contains('copy-btn')) { handleCopy(e.target); return; } const admitButton = e.target.closest('.admit-btn'); if (admitButton) { openPatientModal(null, admitButton.dataset.ward); return; } const patientCard = e.target.closest('.patient-card:not(.vacant)'); if (patientCard) { const patientId = patientCard.dataset.id; const patient = allData.active.find(p => p.id === patientId); const actionBtn = e.target.closest('.card-action-btn'); if (actionBtn) { const action = actionBtn.dataset.action; if (action === 'edit') openPatientModal(patient, patient.ward); else if (action === 'discharge') openActionsModal(patient); } else { openPatientModal(patient, patient.ward); } } });
    modals.actions.addEventListener('click', (e) => { const actionBtn = e.target.closest('.action-modal-btn'); if (!actionBtn) return; const patientId = modals.actions.dataset.patientId; const patient = allData.active.find(p => p.id === patientId); handleDischargeAction(actionBtn.dataset.action, patient); });
    forms.hospitalTransfer.addEventListener('submit', (e) => { e.preventDefault(); const patientId = forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value; const hospital = forms.hospitalTransfer.elements['transfer-hospital'].value; const patient = allData.active.find(p => p.id === patientId); if (patient && hospital) { archiveAndRemove(patient, 'ward_transferred', { transferredTo: hospital, transferTime: new Date().toISOString() }); } closeModal('hospitalTransfer'); });
    forms.bedTransfer.addEventListener('submit', (e) => { e.preventDefault(); const patientId = forms.bedTransfer.elements['bed-transfer-patient-id'].value; const newWard = forms.bedTransfer.elements['transfer-ward-select'].value; const newBed = forms.bedTransfer.elements['transfer-bed-number'].value; if (patientId && newWard && newBed) { db.collection('ward_patients').doc(patientId).update({ ward: newWard, bedNumber: newBed }); } closeModal('bedTransfer'); });
    forms.patient.addEventListener('submit', e => { e.preventDefault(); const patientId = document.getElementById('patient-id-input').value; const patientData = { ward: document.getElementById('ward-name-input').value, bedNumber: document.getElementById('bed-number').value, patientName: document.getElementById('patient-name').value, age: document.getElementById('patient-age').value, sex: document.getElementById('patient-sex').value, hospitalNumber: document.getElementById('hospital-number').value, idCardNumber: document.getElementById('id-card-number').value, allergies: document.getElementById('allergies').value, comorbidities: document.getElementById('comorbidities').value, shortHistory: document.getElementById('short-history').value, diagnosis: document.getElementById('diagnosis').value, ongoingManagement: document.getElementById('ongoing-management').value, plan: document.getElementById('plan').value, }; const newEventText = document.getElementById('significant-events').value.trim(); if (patientId) { if (newEventText) { patientData.significantEvents = firebase.firestore.FieldValue.arrayUnion(`[${new Date().toLocaleString()}] ${newEventText}`); } db.collection('ward_patients').doc(patientId).update(patientData).then(() => closeModal('patient')); } else { patientData.admissionDate = new Date().toISOString(); patientData.significantEvents = newEventText ? [`[${new Date().toLocaleString()}] ${newEventText}`] : []; db.collection('ward_patients').add(patientData).then(() => closeModal('patient')); } });
    document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
    window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
    signOutBtn.addEventListener('click', () => auth.signOut());
    Object.keys(navButtons).forEach(key => { if (navButtons[key]) navButtons[key].addEventListener('click', () => showView(key)); });
    Object.keys(searchBars).forEach(key => { if (searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    
    if (statsNav.prevDay) { statsNav.prevDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() - 1); updateStatsForDate(); }); }
    if (statsNav.nextDay) { statsNav.nextDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() + 1); updateStatsForDate(); }); }

    setupRealtimeListeners();
    showView('board');
}
