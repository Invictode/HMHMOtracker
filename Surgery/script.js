// --- Use the SAME Firebase config ---
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
const appId = firebaseConfig.projectId; // Use projectId for consistency
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
} catch (e) {
    console.error("Firebase initialization failed.", e);
}

// --- AUTHENTICATION CHECK ---
auth.onAuthStateChanged(user => {
    if (user) {
        initializeApp();
    } else {
        window.location.href = 'login.html';
    }
});

// --- MAIN APP FUNCTION ---
function initializeApp() {
    // --- APP STATE & CONFIG ---
    const wardsConfig = [
        { name: "Surgical Ward", beds: ["45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "HDU-1", "HDU-2"] },
        { name: "Private Ward", beds: [] },
        { name: "Medical Ward", beds: [] },
        { name: "ICU", beds: [] }
    ];
    const DB_COLLECTIONS = {
        active: 'surgical_patients',
        discharged: 'surgical_discharged',
        transferred: 'surgical_transferred',
        lamaDor: 'surgical_lama_dor'
    };
    let allData = { active: [], discharged: [], transferred: [], lamaDor: [] };
    let statsCurrentDate = new Date();

    // --- DOM ELEMENT REFERENCES ---
    const mainContent = document.getElementById('main-content');
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal'), bedTransfer: document.getElementById('bed-transfer-modal') };
    const forms = { patient: document.getElementById('patient-form'), hospitalTransfer: document.getElementById('hospital-transfer-form'), bedTransfer: document.getElementById('bed-transfer-form') };
    const signOutBtn = document.getElementById('sign-out-btn');
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    const views = { board: document.getElementById('ward-board-view'), discharged: document.getElementById('discharged-view'), transferred: document.getElementById('transferred-view'), lama: document.getElementById('lama-view'), stats: document.getElementById('stats-view') };
    const tableBodies = { discharged: document.getElementById('discharged-table-body'), transferred: document.getElementById('transferred-table-body'), lamaDor: document.getElementById('lama-table-body') };
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lamaDor: document.getElementById('search-lama') };
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display') };

    // --- HELPER FUNCTIONS ---
    function updateDashboardData(occupiedCount) {
        const today = new Date();
        const dateString = today.toISOString().slice(0, 10);
        const storageKey = 'hmhmo_Surgery_history'; 
        
        let departmentHistory = JSON.parse(localStorage.getItem(storageKey) || '{}');
        departmentHistory[dateString] = occupiedCount;
        
        localStorage.setItem(storageKey, JSON.stringify(departmentHistory));
        console.log(`Dashboard history for Surgery updated for ${dateString}: ${occupiedCount} beds`);
    }

    function showView(viewName) {
        if (viewName === 'stats') updateStatsForDate();
        Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
        Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
        if (views[viewName]) views[viewName].style.display = 'block';
        if (navButtons[viewName]) navButtons[viewName].classList.add('active');
    }

    function closeModal(modalName) {
        if (modals[modalName]) modals[modalName].style.display = 'none';
    }

    function openPatientModal(patient, wardName, bedNumber) {
        const form = forms.patient;
        form.reset();
        modals.patient.querySelector('#modal-title').textContent = patient ? `Edit Patient - Bed ${patient.bedNumber}` : `Admit Patient to ${wardName}`;
        form.elements['patient-id-input'].value = patient ? patient.id : '';
        form.elements['ward-name-input'].value = patient ? patient.ward : wardName;

        if (patient) {
            form.elements['bed-number'].value = patient.bedNumber;
            form.elements['department'].value = patient.department;
            form.elements['patient-name'].value = patient.patientName;
            form.elements['patient-age'].value = patient.age;
            form.elements['patient-sex'].value = patient.sex;
            form.elements['date-of-op'].value = patient.dateOfOp;
            form.elements['op-status'].value = patient.opStatus;
            form.elements['procedure'].value = patient.procedure;
            form.elements['diagnosis'].value = patient.diagnosis;
            form.elements['plan'].value = patient.plan;
        } else {
            form.elements['bed-number'].value = bedNumber || '';
        }
        modals.patient.style.display = 'block';
    }

    function openActionsModal(patient) {
        modals.actions.querySelector('#actions-patient-name').textContent = patient.patientName;
        modals.actions.dataset.patientId = patient.id;
        modals.actions.style.display = 'block';
    }
    
    function openBedTransferModal(patient) {
        const modal = document.getElementById('bed-transfer-modal');
        if (!modal) return;
        document.getElementById('bed-transfer-patient-name').textContent = patient.patientName;
        modal.dataset.patientId = patient.id;

        const wardSelect = document.getElementById('transfer-ward-select');
        wardSelect.innerHTML = '';
        wardsConfig.forEach(ward => {
            const option = document.createElement('option');
            option.value = ward.name;
            option.textContent = ward.name;
            if (ward.name === patient.ward) option.selected = true;
            wardSelect.appendChild(option);
        });

        document.getElementById('transfer-bed-number').value = patient.bedNumber;
        modal.style.display = 'block';
    }

    function openHospitalTransferModal(patient) {
        forms.hospitalTransfer.querySelector('#hospital-transfer-patient-name').textContent = patient.patientName;
        forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value = patient.id;
        closeModal('actions');
        modals.hospitalTransfer.style.display = 'block';
    }

    function archiveAndRemove(patient, collectionName, additionalData) {
        if (patient) {
            const basePath = `/artifacts/${appId}/public/data/`;
            db.collection(`${basePath}${collectionName}`).add({ ...patient, ...additionalData })
                .then(() => db.collection(`${basePath}${DB_COLLECTIONS.active}`).doc(patient.id).delete());
        }
    }

    function handleDischargeAction(action, patient) {
        switch (action) {
            case 'bed-transfer':
                 openBedTransferModal(patient);
                 closeModal('actions');
                 break;
            case 'discharge-home':
                archiveAndRemove(patient, DB_COLLECTIONS.discharged, { dischargeTime: new Date().toISOString() });
                closeModal('actions');
                break;
            case 'transfer':
                openHospitalTransferModal(patient);
                break;
            case 'lama':
                archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'LAMA', eventTime: new Date().toISOString() });
                closeModal('actions');
                break;
            case 'dor':
                archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'DOR', eventTime: new Date().toISOString() });
                closeModal('actions');
                break;
        }
    }

    function printPatientCard(patientId) {
        const patient = allData.active.find(p => p.id === patientId);
        if (!patient) return;
        const printArea = document.getElementById('print-area');
        const cardClone = document.querySelector(`.patient-card[data-id='${patientId}']`).cloneNode(true);
        const actions = cardClone.querySelector('.card-actions');
        if (actions) actions.remove();
        printArea.innerHTML = '';
        printArea.appendChild(cardClone);
        window.print();
    }

    function renderWards() {
        views.board.innerHTML = '';
        wardsConfig.forEach(wardInfo => {
            const wardSection = document.createElement('div');
            wardSection.className = 'ward-section';
            wardSection.innerHTML = `<div class="ward-header"><h2><i class="fa-solid fa-bed-pulse"></i> ${wardInfo.name}</h2><button class="admit-btn" data-ward="${wardInfo.name}"><i class="fa-solid fa-user-plus"></i> Admit Patient</button></div><div class="bed-grid" id="grid-${wardInfo.name.replace(/\s+/g, '-')}"></div>`;
            views.board.appendChild(wardSection);
        });
        renderAllPatients();
    }

    function renderAllPatients() {
        document.querySelectorAll('.bed-grid').forEach(grid => grid.innerHTML = '');
        let surgicalOccupiedCount = 0;

        wardsConfig.forEach(wardInfo => {
            const allPatientsInWard = allData.active.filter(p => p.ward === wardInfo.name);
            const gridId = `grid-${wardInfo.name.replace(/\s+/g, '-')}`;
            const patientGrid = document.getElementById(gridId);

            if (patientGrid) {
                let bedsToRender;
                if (wardInfo.name === "Surgical Ward") {
                    bedsToRender = [...wardInfo.beds];
                    const occupiedSurgicalBeds = new Set();
                    allPatientsInWard.forEach(patient => {
                        if (bedsToRender.includes(patient.bedNumber)) {
                            occupiedSurgicalBeds.add(patient.bedNumber);
                        }
                    });
                    surgicalOccupiedCount = occupiedSurgicalBeds.size;
                } else {
                    bedsToRender = allPatientsInWard.map(p => p.bedNumber);
                }

                if (bedsToRender.length === 0) {
                    patientGrid.innerHTML = `<p class="empty-ward-message">No patients currently admitted.</p>`;
                }
                
                bedsToRender.sort((a, b) => (parseInt(a.match(/\d+/)) || 0) - (parseInt(b.match(/\d+/)) || 0) || a.localeCompare(b));
                
                bedsToRender.forEach(bedNumber => {
                    const patient = allPatientsInWard.find(p => p.bedNumber === bedNumber);
                    const card = document.createElement('div');
                    card.className = `patient-card ${patient ? '' : 'vacant'}`;
                    
                    if (patient) {
                        card.dataset.id = patient.id;
                        const today = new Date();
                        const opDate = patient.dateOfOp ? new Date(patient.dateOfOp) : null;
                        const postOpDay = opDate ? Math.ceil((today - opDate) / (1000 * 60 * 60 * 24)) : 'N/A';
                        const deptClass = `dept-${patient.department?.toLowerCase().replace(/\s/g, '-') || 'default'}`;
                        card.innerHTML = `<div class="patient-card-header"><span class="bed-number">Bed: ${patient.bedNumber}</span><div><span class="patient-name">${patient.patientName}</span><span class="department-tag ${deptClass}">${patient.department}</span></div></div><div class="patient-info"><p><strong>Age/Sex:</strong> ${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</p><p><strong>Procedure:</strong> ${patient.procedure || 'N/A'}</p><p><strong>DOO:</strong> ${patient.dateOfOp || 'N/A'} (POD ${postOpDay})</p><p><strong>Status:</strong> ${patient.opStatus || 'N/A'}</p><p><strong>Plan:</strong> ${patient.plan || 'N/A'}</p></div><div class="card-actions"><button class="card-action-btn edit" data-action="edit"><i class="fa-solid fa-pen-to-square"></i> Details</button><button class="card-action-btn discharge" data-action="discharge"><i class="fa-solid fa-right-from-bracket"></i> Actions</button><button class="card-action-btn print" data-action="print"><i class="fa-solid fa-print"></i> Print</button></div>`;
                    } else {
                        card.dataset.ward = wardInfo.name;
                        card.dataset.bed = bedNumber;
                        card.innerHTML = `<div class="patient-card-header"><span class="bed-number">Bed: ${bedNumber}</span><span class="patient-name">Vacant</span></div>`;
                    }
                    patientGrid.appendChild(card);
                });
            }
        });
        updateDashboardData(surgicalOccupiedCount);
    }

    function updateStatsForDate() {
        if (!views.stats || views.stats.style.display === 'none') return;
        
        const localDate = new Date(statsCurrentDate);
        localDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        statsNav.dateDisplay.textContent = localDate.getTime() === today.getTime() ? 'Today' : localDate.toLocaleDateString('en-CA');
        statsNav.nextDay.disabled = localDate.getTime() >= today.getTime();
        
        const getShiftTimestamps = date => {
            const dayStart8AM = new Date(date); dayStart8AM.setHours(8, 0, 0, 0);
            const prevDay8AM = new Date(dayStart8AM); prevDay8AM.setDate(prevDay8AM.getDate() - 1);
            return { shift3_start: prevDay8AM, shift1_start: dayStart8AM, shift2_start: new Date(new Date(date).setHours(16, 0, 0, 0)), endOfDay: new Date(new Date(dayStart8AM).setDate(dayStart8AM.getDate() + 1)) };
        };

        const dailyTimestamps = getShiftTimestamps(statsCurrentDate);
        const filterByShift = (list, timeField, start, end) => list.filter(item => { const itemTime = new Date(item[timeField]); return itemTime >= start && itemTime < end; });
        
        const allAdmittedInPeriod = [...allData.active, ...allData.discharged, ...allData.transferred, ...allData.lamaDor].filter(p => { const admTime = new Date(p.admissionDate); return admTime >= dailyTimestamps.shift3_start && admTime < dailyTimestamps.endOfDay; });
        
        document.getElementById('stats-s1-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', dailyTimestamps.shift1_start, dailyTimestamps.shift2_start).length;
        document.getElementById('stats-s2-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', dailyTimestamps.shift2_start, new Date(new Date(statsCurrentDate).setHours(23, 59, 59, 999))).length;
        document.getElementById('stats-s3-total').textContent = filterByShift(allAdmittedInPeriod, 'admissionDate', new Date(new Date(statsCurrentDate).setHours(0, 0, 0, 0)), dailyTimestamps.shift1_start).length;
    }

    function renderList(key) {
        const getRowRenderer = (rendererKey) => {
            const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A';
            switch(rendererKey) {
                case 'discharged': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.department}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`;
                case 'transferred': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.department}</td><td>${item.transferredTo}</td><td>${formatTime(item.transferTime)}</td>`;
                case 'lamaDor': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.department}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td>`;
                default: return () => '';
            }
        };
        const tbody = tableBodies[key];
        const items = allData[key];
        const renderRowFunc = getRowRenderer(key);
        const searchTerm = (searchBars[key] ? searchBars[key].value : "").toLowerCase();
        if (!tbody || !items || !renderRowFunc) return;
        const filteredItems = items.filter(item => (item.patientName && item.patientName.toLowerCase().includes(searchTerm)));
        tbody.innerHTML = '';
        if (filteredItems.length === 0) {
            const colspan = tbody.parentElement.querySelector('thead tr').childElementCount;
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-ward-message">${searchTerm ? 'No matching patients found.' : 'No patients in this list.'}</td></tr>`;
        } else {
            filteredItems.forEach(item => {
                const row = document.createElement('tr'); row.innerHTML = renderRowFunc(item); tbody.appendChild(row);
            });
        }
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

    // --- INITIALIZATION ---
    mainContent.addEventListener('click', e => {
        const admitButton = e.target.closest('.admit-btn');
        if (admitButton) { openPatientModal(null, admitButton.dataset.ward, ''); return; }

        const card = e.target.closest('.patient-card');
        if (card) {
            const patientId = card.dataset.id;
            if (patientId) {
                const patient = allData.active.find(p => p.id === patientId);
                const actionBtn = e.target.closest('.card-action-btn');
                if (actionBtn && patient) {
                    const action = actionBtn.dataset.action;
                    if (action === 'edit') openPatientModal(patient);
                    else if (action === 'discharge') openActionsModal(patient);
                    else if (action === 'print') printPatientCard(patientId);
                } else if (patient) openPatientModal(patient);
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

    forms.patient.addEventListener('submit', e => {
        e.preventDefault();
        const patientId = forms.patient.elements['patient-id-input'].value;
        const patientData = {
            ward: forms.patient.elements['ward-name-input'].value,
            bedNumber: forms.patient.elements['bed-number'].value,
            department: forms.patient.elements['department'].value,
            patientName: forms.patient.elements['patient-name'].value,
            age: forms.patient.elements['patient-age'].value,
            sex: forms.patient.elements['patient-sex'].value,
            dateOfOp: forms.patient.elements['date-of-op'].value,
            opStatus: forms.patient.elements['op-status'].value,
            procedure: forms.patient.elements['procedure'].value,
            diagnosis: forms.patient.elements['diagnosis'].value,
            plan: forms.patient.elements['plan'].value,
        };
        const basePath = `/artifacts/${appId}/public/data/`;
        const docRef = patientId ? db.collection(`${basePath}${DB_COLLECTIONS.active}`).doc(patientId) : db.collection(`${basePath}${DB_COLLECTIONS.active}`);
        
        if (patientId) {
            docRef.update(patientData).then(() => closeModal('patient'));
        } else {
            patientData.admissionDate = new Date().toISOString();
            docRef.add(patientData).then(() => closeModal('patient'));
        }
    });
    
    forms.bedTransfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = modals.bedTransfer.dataset.patientId;
        const newWard = document.getElementById('transfer-ward-select').value;
        const newBed = document.getElementById('transfer-bed-number').value;
        if (patientId && newWard && newBed) {
            const basePath = `/artifacts/${appId}/public/data/`;
            db.collection(`${basePath}${DB_COLLECTIONS.active}`).doc(patientId).update({
                ward: newWard,
                bedNumber: newBed
            }).then(() => {
                closeModal('bedTransfer');
            });
        }
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
    Object.keys(navButtons).forEach(key => { if (navButtons[key]) navButtons[key].addEventListener('click', () => showView(key)); });
    Object.keys(searchBars).forEach(key => { if (searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    
    statsNav.prevDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() - 1); updateStatsForDate(); });
    statsNav.nextDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() + 1); updateStatsForDate(); });
    
    renderWards();
    setupRealtimeListeners();
    showView('board');
}
