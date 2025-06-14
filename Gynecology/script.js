// --- Use the SAME Firebase config as your ER Tracker ---
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
const appId = firebaseConfig.projectId; 
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
} catch (e) {
    console.error("Firebase initialization failed.", e);
}

// --- GLOBAL APP STATE & CONFIG ---
const wardsConfig = [
    { name: "Gynecology Ward", beds: ["33", "34", "35", "36", "37", "38", "39", "40"], monitoringBeds: ["36", "40"] },
    { name: "Labour Room", beds: ["LR 1", "LR 2", "LR 3", "LR 4"], monitoringBeds: [] },
    { name: "Surgical Ward", beds: [], monitoringBeds: [] },
    { name: "ICU", beds: [], monitoringBeds: [] },
    { name: "Private Rooms", beds: [], monitoringBeds: [] }
];
const DB_COLLECTIONS = { active: `gynae_patients`, discharged: `gynae_discharged`, transferred: `gynae_transferred`, lamaDor: `gynae_lama_dor` };
let allData = { active: [], discharged: [], transferred: [], lamaDor: [] };
let statsCurrentDate = new Date();

// --- AUTHENTICATION CHECK ---
auth.onAuthStateChanged(user => {
    if (user) {
        initializeApp();
    } else {
        window.location.href = '../login.html';
    }
});


// --- HELPER FUNCTIONS ---
function showView(viewName) {
    const views = { board: document.getElementById('ward-board-view'), discharged: document.getElementById('discharged-view'), transferred: document.getElementById('transferred-view'), lama: document.getElementById('lama-view'), stats: document.getElementById('stats-view') };
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
    Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
    if (views[viewName]) views[viewName].style.display = 'flex';
    if (navButtons[viewName]) navButtons[viewName].classList.add('active');
    if (viewName === 'stats') updateStatsForDate();
}
function closeModal(modalName) {
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal') };
    if (modals[modalName]) modals[modalName].style.display = 'none';
}
function openPatientModal(patient, wardName, bedNumber) {
    const form = document.getElementById('patient-form');
    const modal = document.getElementById('patient-modal');
    form.reset();
    document.getElementById('modal-title').textContent = patient ? `Edit Patient - Bed ${patient.bedNumber}` : `Admit Patient to ${wardName}`;
    form.elements['patient-id-input'].value = patient ? patient.id : '';
    form.elements['ward-name-input'].value = patient ? patient.ward : wardName;
    
    const wardConfig = wardsConfig.find(w => w.name === (patient ? patient.ward : wardName));
    const bedNumberInput = document.getElementById('bed-number');
    const bedNumberSelect = document.getElementById('bed-number-select');
    const bedNumberLabel = document.getElementById('bed-number-label');
    
    if (wardConfig && wardConfig.beds.length > 0) {
        bedNumberInput.style.display = 'none';
        bedNumberSelect.style.display = 'block';
        bedNumberLabel.textContent = 'Select Bed:';
        bedNumberSelect.innerHTML = ''; 
        const occupiedBedsInWard = allData.active.filter(p => p.ward === wardName).map(p => p.bedNumber);
        
        wardConfig.beds.forEach(bed => {
            const option = document.createElement('option');
            option.value = bed;
            option.textContent = bed;
            if (occupiedBedsInWard.includes(bed) && (!patient || patient.bedNumber !== bed)) {
                option.disabled = true;
                option.textContent += ' (Occupied)';
            }
            if (patient && patient.bedNumber === bed) { option.selected = true; }
            bedNumberSelect.appendChild(option);
        });
        bedNumberSelect.value = patient ? patient.bedNumber : bedNumberSelect.value;

    } else {
        bedNumberInput.style.display = 'block';
        bedNumberSelect.style.display = 'none';
        bedNumberLabel.textContent = 'Enter Bed Number:';
        bedNumberInput.value = patient ? patient.bedNumber : '';
    }

    if (patient) {
        form.elements['patient-name'].value = patient.patientName || '';
        form.elements['patient-age'].value = patient.age || '';
        form.elements['gestational-age'].value = patient.gestationalAge || '';
        form.elements['gravida-para'].value = patient.gravidaPara || '';
        form.elements['presenting-complaint'].value = patient.presentingComplaint || '';
        form.elements['comorbidities'].value = patient.comorbidities || '';
        form.elements['drug-allergies'].value = patient.drugAllergies || '';
        form.elements['diagnosis'].value = patient.diagnosis || '';
        form.elements['plan'].value = patient.plan || '';
    }
    modal.style.display = 'block';
}
function openActionsModal(patient) {
    document.getElementById('actions-patient-name').textContent = patient.patientName;
    document.getElementById('actions-modal').dataset.patientId = patient.id;
    document.getElementById('actions-modal').style.display = 'block';
}
function openHospitalTransferModal(patient) {
    document.getElementById('hospital-transfer-patient-name').textContent = patient.patientName;
    document.getElementById('hospital-transfer-form').elements['hospital-transfer-patient-id'].value = patient.id;
    closeModal('actions');
    document.getElementById('hospital-transfer-modal').style.display = 'block';
}
function archiveAndRemove(patient, collectionName, additionalData) {
    if (patient) {
        const fullCollectionPath = `/artifacts/${appId}/public/data/${collectionName}`;
        const activeDocPath = `/artifacts/${appId}/public/data/${DB_COLLECTIONS.active}/${patient.id}`;
        db.collection(fullCollectionPath).add({ ...patient, ...additionalData })
            .then(() => db.doc(activeDocPath).delete());
    }
}
function handleDischargeAction(action, patient) {
    switch (action) {
        case 'discharge-home': if (confirm(`Confirm discharge for ${patient.patientName}?`)) { archiveAndRemove(patient, DB_COLLECTIONS.discharged, { dischargeTime: new Date().toISOString() }); closeModal('actions'); } break;
        case 'transfer': openHospitalTransferModal(patient); break;
        case 'lama': if (confirm("Confirm LAMA?")) { archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'LAMA', eventTime: new Date().toISOString() }); closeModal('actions'); } break;
        case 'dor': if (confirm("Confirm DOR?")) { archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'DOR', eventTime: new Date().toISOString() }); closeModal('actions'); } break;
    }
}
function saveOccupancyToLocalStorage(departmentId) {
    const gyneWardGrid = document.getElementById('grid-Gynecology-Ward');
    if (!gyneWardGrid) { console.error("Gynecology Ward grid not found."); return; }
    const allBeds = gyneWardGrid.querySelectorAll('.patient-card');
    let occupiedCount = 0;
    allBeds.forEach(bed => { if (!bed.classList.contains('vacant')) { occupiedCount++; } });
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10);
    const storageKey = `hmhmo_${departmentId}_history`;
    let departmentHistory = JSON.parse(localStorage.getItem(storageKey) || '{}');
    departmentHistory[dateString] = occupiedCount;
    localStorage.setItem(storageKey, JSON.stringify(departmentHistory));
    console.log(`${departmentId} history updated for ${dateString}: ${occupiedCount} beds`);
}

function renderWards() {
    const wardBoardContainer = document.getElementById('ward-board-view');
    wardBoardContainer.innerHTML = '';
    wardsConfig.forEach(wardInfo => {
        const wardSection = document.createElement('div');
        wardSection.className = 'ward-section';
        wardSection.innerHTML = `<div class="ward-header"><h2><i class="fa-solid fa-venus"></i> ${wardInfo.name}</h2><button class="admit-btn" data-ward="${wardInfo.name}"><i class="fa-solid fa-user-plus"></i> Admit Patient</button></div><div class="bed-grid" id="grid-${wardInfo.name.replace(/\s+/g, '-')}"></div>`;
        wardBoardContainer.appendChild(wardSection);
    });
    renderAllPatients();
}

// --- NEW: Function to determine a patient's ward based on bed number prefix ---
function getWardForPatient(patient) {
    const bed = (patient.bedNumber || '').toUpperCase();
    if (bed.startsWith('SW')) return 'Surgical Ward';
    if (bed.startsWith('PVT')) return 'Private Rooms';
    if (bed.startsWith('ICU')) return 'ICU';
    // Default to the ward stored in the patient's data, or Gynecology Ward if none.
    return patient.ward || 'Gynecology Ward'; 
}

// --- MODIFIED: Uses the new getWardForPatient function for routing ---
function renderAllPatients() {
    document.querySelectorAll('.bed-grid').forEach(grid => grid.innerHTML = '');
    
    // Create a map of patients by their real ward for efficient lookup
    const patientsByWard = {};
    wardsConfig.forEach(w => patientsByWard[w.name] = []);
    allData.active.forEach(p => {
        const correctWard = getWardForPatient(p);
        if (patientsByWard[correctWard]) {
            patientsByWard[correctWard].push(p);
        }
    });

    wardsConfig.forEach(wardInfo => {
        const wardPatients = patientsByWard[wardInfo.name].sort((a,b) => a.bedNumber.localeCompare(b.bedNumber, undefined, {numeric: true}));
        const gridId = `grid-${wardInfo.name.replace(/\s+/g, '-')}`;
        const patientGrid = document.getElementById(gridId);
        
        if (patientGrid) {
            const occupiedBedsInWard = new Set(wardPatients.map(p => p.bedNumber));
            const allBedsToRender = new Set([...wardInfo.beds, ...occupiedBedsInWard]);

            if (allBedsToRender.size > 0) {
                 [...allBedsToRender].sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(bedNumber => {
                    const patient = wardPatients.find(p => p.bedNumber === bedNumber);
                    renderPatientCard(patientGrid, patient, wardInfo, bedNumber);
                });
            } else {
                 patientGrid.innerHTML = `<div class="empty-ward-message">No patients in ${wardInfo.name}.</div>`;
            }
        }
    });
    saveOccupancyToLocalStorage('Gynecology');
}

function renderPatientCard(grid, patient, wardInfo, bedNumber) {
    const isMonitoring = wardInfo.monitoringBeds.includes(bedNumber);
    const card = document.createElement('div');
    card.className = `patient-card ${patient ? '' : 'vacant'} ${isMonitoring ? 'monitoring' : ''}`;
    if (patient) { card.dataset.id = patient.id; } 
    else { card.dataset.ward = wardInfo.name; card.dataset.bed = bedNumber; }
    
    card.innerHTML = patient ? `
        <div class="patient-card-header">
            <span class="bed-number">Bed ${patient.bedNumber}</span>
            <span class="patient-name">${patient.patientName}</span>
        </div>
        <div class="patient-info">
            <p><strong>Age / Sex:</strong> <span class="info-value">${patient.age || 'N/A'} / Female</span></p>
            <p><strong>G / P:</strong> <span class="info-value">${patient.gravidaPara || 'N/A'}</span></p>
            <p><strong>Gest. Age:</strong> <span class="info-value">${patient.gestationalAge || 'N/A'}</span></p>
            <p><strong>Complaint:</strong> <span class="info-value">${patient.presentingComplaint || 'N/A'}</span></p>
            <p><strong>Comorbids:</strong> <span class="info-value">${patient.comorbidities || 'N/A'}</span></p>
            <p><strong>Allergies:</strong> <span class="info-value">${patient.drugAllergies || 'N/A'}</span></p>
            <p><strong>Diagnosis:</strong> <span class="info-value bold">${patient.diagnosis || 'N/A'}</span></p>
            <p><strong>Plan:</strong> <span class="info-value bold">${patient.plan || 'N/A'}</span></p>
        </div>
        <div class="card-actions">
            <button class="card-action-btn edit" data-action="edit">Details</button>
            <button class="card-action-btn discharge" data-action="discharge">Actions</button>
        </div>` : `<div class="patient-card-header"><span class="bed-number">Bed ${bedNumber}</span></div><div class="vacant-status">Vacant</div>`;
    grid.appendChild(card);
}
function updateStatsForDate() {
    const statsView = document.getElementById('stats-view');
    if (!statsView || statsView.style.display === 'none') return;
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display'), };
    const localDate = new Date(statsCurrentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    localDate.setHours(0, 0, 0, 0);
    statsNav.dateDisplay.textContent = localDate.getTime() === today.getTime() ? 'Today' : localDate.toLocaleDateString('en-CA');
    statsNav.nextDay.disabled = localDate.getTime() >= today.getTime();
    const getShiftTimestamps = date => { const dayStart8AM = new Date(date); dayStart8AM.setHours(8, 0, 0, 0); const prevDay8AM = new Date(dayStart8AM); prevDay8AM.setDate(prevDay8AM.getDate() - 1); return { shift3_start: prevDay8AM, shift1_start: dayStart8AM, shift2_start: new Date(new Date(date).setHours(16, 0, 0, 0)), endOfDay: new Date(new Date(dayStart8AM).setDate(dayStart8AM.getDate() + 1)) }; };
    const dailyTimestamps = getShiftTimestamps(statsCurrentDate);
    const filterByShift = (list, timeField, start, end) => list.filter(item => { const itemTime = new Date(item[timeField]); return itemTime >= start && itemTime < end; });
    const allAdmittedInPeriod = [...allData.active, ...allData.discharged, ...allData.transferred, ...allData.lamaDor].filter(p => { const admTime = new Date(p.admissionDate); return admTime >= dailyTimestamps.shift3_start && admTime < dailyTimestamps.endOfDay; });
    document.getElementById('stats-s1-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', dailyTimestamps.shift1_start, dailyTimestamps.shift2_start).length;
    document.getElementById('stats-s2-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', dailyTimestamps.shift2_start, new Date(new Date(statsCurrentDate).setHours(23, 59, 59, 999))).length;
    document.getElementById('stats-s3-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', new Date(new Date(statsCurrentDate).setHours(0, 0, 0, 0)), dailyTimestamps.shift1_start).length;
}
function renderList(key) {
    const tableBodies = { discharged: document.getElementById('discharged-table-body'), transferred: document.getElementById('transferred-table-body'), lamaDor: document.getElementById('lama-table-body'), };
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lamaDor: document.getElementById('search-lama'), };
    const tbody = tableBodies[key];
    const items = allData[key];
    const timeField = { discharged: 'dischargeTime', transferred: 'transferTime', lamaDor: 'eventTime' }[key];
    const getRowRenderer = (rendererKey) => { const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A'; switch(rendererKey) { case 'discharged': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`; case 'transferred': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.transferredTo}</td><td>${formatTime(item.transferTime)}</td>`; case 'lamaDor': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td>`; default: return () => ''; } };
    const renderRowFunc = getRowRenderer(key);
    const searchTerm = (searchBars[key] ? searchBars[key].value : "").toLowerCase();
    if (!tbody || !items || !renderRowFunc || !timeField) return;
    const filteredItems = items.filter(item => (item.patientName && item.patientName.toLowerCase().includes(searchTerm)));
    tbody.innerHTML = '';
    
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
}
function groupDataByShift(items, timeField) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shifts = { shift1: { name: 'Shift 1 (8am - 4pm)', start: new Date(today.getTime() + 8 * 3600000), end: new Date(today.getTime() + 16 * 3600000), items: [] }, shift2: { name: 'Shift 2 (4pm - 12am)', start: new Date(today.getTime() + 16 * 3600000), end: new Date(today.getTime() + 24 * 3600000), items: [] }, shift3: { name: 'Shift 3 (12am - 8am)', start: today, end: new Date(today.getTime() + 8 * 3600000), items: [] }, };
    const todayItems = items.filter(item => new Date(item[timeField]) >= today);
    const olderItems = items.filter(item => new Date(item[timeField]) < today);
    todayItems.forEach(item => { const itemTime = new Date(item[timeField]); if (itemTime >= shifts.shift1.start && itemTime < shifts.shift2.start) shifts.shift1.items.push(item); else if (itemTime >= shifts.shift2.start && itemTime < shifts.shift2.end) shifts.shift2.items.push(item); else if (itemTime >= shifts.shift3.start && itemTime < shifts.shift1.start) shifts.shift3.items.push(item); });
    return { shifts, olderItems };
}
function setupRealtimeListeners() {
    const basePath = `/artifacts/${appId}/public/data/`;
    db.collection(`${basePath}${DB_COLLECTIONS.active}`).onSnapshot(snapshot => {
        allData.active = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAllPatients();
        updateStatsForDate();
    });
    ['discharged', 'transferred', 'lamaDor'].forEach(key => {
        const collectionName = DB_COLLECTIONS[key];
        const timeField = key === 'lamaDor' ? 'eventTime' : (key === 'discharged' ? 'dischargeTime' : 'transferTime');
        db.collection(`${basePath}${collectionName}`).orderBy(timeField, 'desc').onSnapshot(snapshot => {
            allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateStatsForDate();
            renderList(key);
        });
    });
}

// --- MAIN APP INITIALIZATION ---
function initializeApp() {
    const mainContent = document.getElementById('main-content');
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal') };
    const forms = { patient: document.getElementById('patient-form'), hospitalTransfer: document.getElementById('hospital-transfer-form') };
    const signOutBtn = document.getElementById('sign-out-btn');
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display'), };

    mainContent.addEventListener('click', (e) => {
        const admitButton = e.target.closest('.admit-btn');
        if (admitButton) { openPatientModal(null, admitButton.dataset.ward, ''); return; }
        const card = e.target.closest('.patient-card');
        if (card) {
            const patientId = card.dataset.id;
            if (patientId) {
                const patient = allData.active.find(p => p.id === patientId);
                const actionBtn = e.target.closest('.card-action-btn');
                if (actionBtn) {
                    const action = actionBtn.dataset.action;
                    if (action === 'edit') openPatientModal(patient);
                    else if (action === 'discharge') openActionsModal(patient);
                } else openPatientModal(patient);
            } else openPatientModal(null, card.dataset.ward, card.dataset.bed);
        }
    });

    modals.actions.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.action-modal-btn');
        if (!actionBtn) return;
        const patientId = modals.actions.dataset.patientId;
        const patient = allData.active.find(p => p.id === patientId);
        if(patient) handleDischargeAction(actionBtn.dataset.action, patient);
    });

    forms.patient.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = document.getElementById('patient-id-input').value;
        const wardName = document.getElementById('ward-name-input').value;
        const wardConfig = wardsConfig.find(w => w.name === wardName);
        const bedNumber = (wardConfig && wardConfig.beds.length > 0) ? document.getElementById('bed-number-select').value : document.getElementById('bed-number').value;

        const patientData = { ward: wardName, bedNumber: bedNumber, patientName: document.getElementById('patient-name').value, age: document.getElementById('patient-age').value, sex: 'Female', gestationalAge: document.getElementById('gestational-age').value, gravidaPara: document.getElementById('gravida-para').value, presentingComplaint: document.getElementById('presenting-complaint').value, comorbidities: document.getElementById('comorbidities').value, drugAllergies: document.getElementById('drug-allergies').value, diagnosis: document.getElementById('diagnosis').value, plan: document.getElementById('plan').value, };
        const docRef = patientId ? db.doc(`/artifacts/${appId}/public/data/${DB_COLLECTIONS.active}/${patientId}`) : db.collection(`/artifacts/${appId}/public/data/${DB_COLLECTIONS.active}`);
        if (patientId) { docRef.update(patientData).then(() => closeModal('patient')); } 
        else { patientData.admissionDate = new Date().toISOString(); docRef.add(patientData).then(() => closeModal('patient')); }
    });
    
    forms.hospitalTransfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value;
        const hospital = forms.hospitalTransfer.elements['transfer-hospital'].value;
        const patient = allData.active.find(p => p.id === patientId);
        if (patient && hospital) { archiveAndRemove(patient, DB_COLLECTIONS.transferred, { transferredTo: hospital, transferTime: new Date().toISOString() }); }
        closeModal('hospitalTransfer');
    });

    document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
    window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
    signOutBtn.addEventListener('click', () => auth.signOut());
    Object.keys(navButtons).forEach(key => { if (navButtons[key]) navButtons[key].addEventListener('click', () => { showView(key); if (key !== 'board' && key !== 'stats') { renderList(key); }}); });
    
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lamaDor: document.getElementById('search-lama'), };
    Object.keys(searchBars).forEach(key => { if (searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    
    statsNav.prevDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() - 1); updateStatsForDate(); });
    statsNav.nextDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() + 1); updateStatsForDate(); });

    renderWards();
    setupRealtimeListeners();
    showView('board');
}
