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

// --- GLOBAL APP STATE ---
const wardsConfig = [
    { name: "Medical Ward", totalBeds: 11 },
    { name: "Surgical Ward", totalBeds: 0 },
    { name: "Private Ward", totalBeds: 0 },
    { name: "ICU", totalBeds: 0 }
];
let allData = { active: [], discharged: [], transferred: [], lama: [] };
let statsCurrentDate = new Date();

// --- MAIN APP FUNCTION ---
function initializeApp() {
    // --- DOM ELEMENT REFERENCES ---
    const wardBoardContainer = document.getElementById('ward-board-view');
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal'), bedTransfer: document.getElementById('bed-transfer-modal'), };
    const forms = { patient: document.getElementById('patient-form'), hospitalTransfer: document.getElementById('hospital-transfer-form'), bedTransfer: document.getElementById('bed-transfer-form'), };
    const signOutBtn = document.getElementById('sign-out-btn');
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    const views = { board: document.getElementById('ward-board-view'), discharged: document.getElementById('discharged-view'), transferred: document.getElementById('transferred-view'), lama: document.getElementById('lama-view'), stats: document.getElementById('stats-view') };
    const tableBodies = { discharged: document.getElementById('discharged-table-body'), transferred: document.getElementById('transferred-table-body'), lama: document.getElementById('lama-table-body'), };
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lama: document.getElementById('search-lama'), };
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display'), };

    // --- EVENT LISTENERS ---
    wardBoardContainer.addEventListener('click', e => {
        const admitButton = e.target.closest('.admit-btn');
        if (admitButton) { openPatientModal(null, admitButton.dataset.ward); return; }

        const actionBtn = e.target.closest('.card-action-btn');
        if (actionBtn) {
            const patientId = actionBtn.closest('.patient-card').dataset.id;
            const patient = allData.active.find(p => p.id === patientId);
            const action = actionBtn.dataset.action;
            if (action === 'edit') openPatientModal(patient, patient.ward);
            else if (action === 'discharge') openActionsModal(patient);
        }
    });

    modals.actions.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.action-modal-btn');
        if (!actionBtn) return;
        const patientId = modals.actions.dataset.patientId;
        const patient = allData.active.find(p => p.id === patientId);
        handleDischargeAction(actionBtn.dataset.action, patient);
    });

    forms.hospitalTransfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value;
        const hospital = forms.hospitalTransfer.elements['transfer-hospital'].value;
        const patient = allData.active.find(p => p.id === patientId);
        if (patient && hospital) {
            archiveAndRemove(patient, 'ward_transferred', { transferredTo: hospital, transferTime: new Date().toISOString() });
        }
        closeModal('hospitalTransfer');
    });
    
    forms.bedTransfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.bedTransfer.elements['bed-transfer-patient-id'].value;
        const newWard = forms.bedTransfer.elements['transfer-ward-select'].value;
        const newBed = forms.bedTransfer.elements['transfer-bed-number'].value;
        if (patientId && newWard && newBed) {
            db.collection('ward_patients').doc(patientId).update({ ward: newWard, bedNumber: newBed });
        }
        closeModal('bedTransfer');
    });

    forms.patient.addEventListener('submit', e => {
        e.preventDefault();
        const patientId = document.getElementById('patient-id-input').value;
        const patientData = {
            ward: document.getElementById('ward-name-input').value,
            bedNumber: document.getElementById('bed-number').value,
            patientName: document.getElementById('patient-name').value,
            age: document.getElementById('patient-age').value,
            sex: document.getElementById('patient-sex').value,
            comorbidities: document.getElementById('comorbidities').value,
            shortHistory: document.getElementById('short-history').value,
            diagnosis: document.getElementById('diagnosis').value,
            ongoingManagement: document.getElementById('ongoing-management').value,
            plan: document.getElementById('plan').value,
        };
        const newEventText = document.getElementById('significant-events').value.trim();
        
        if (patientId) {
            if (newEventText) {
                patientData.significantEvents = firebase.firestore.FieldValue.arrayUnion(`[${new Date().toLocaleString()}] ${newEventText}`);
            }
            db.collection('ward_patients').doc(patientId).update(patientData).then(() => closeModal('patient'));
        } else {
            patientData.admissionDate = new Date().toISOString();
            patientData.significantEvents = newEventText ? [`[${new Date().toLocaleString()}] ${newEventText}`] : [];
            db.collection('ward_patients').add(patientData).then(() => closeModal('patient'));
        }
    });

    document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
    window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
    signOutBtn.addEventListener('click', () => auth.signOut());
    Object.keys(navButtons).forEach(key => { if (navButtons[key]) navButtons[key].addEventListener('click', () => showView(key)); });
    Object.keys(searchBars).forEach(key => { if (searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    
    if (statsNav.prevDay) {
        statsNav.prevDay.addEventListener('click', () => {
            statsCurrentDate.setDate(statsCurrentDate.getDate() - 1);
            updateStatsForDate();
        });
    }
    if (statsNav.nextDay) {
        statsNav.nextDay.addEventListener('click', () => {
            statsCurrentDate.setDate(statsCurrentDate.getDate() + 1);
            updateStatsForDate();
        });
    }
    
    setupRealtimeListeners();
    showView('board');
}

// --- HELPER FUNCTIONS ---
function showView(viewName) {
    const views = { board: document.getElementById('ward-board-view'), discharged: document.getElementById('discharged-view'), transferred: document.getElementById('transferred-view'), lama: document.getElementById('lama-view'), stats: document.getElementById('stats-view') };
    const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), stats: document.getElementById('nav-stats') };
    
    if (viewName === 'stats') {
        updateStatsForDate();
    }
    Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
    Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
    if (views[viewName]) views[viewName].style.display = 'block';
    if (navButtons[viewName]) navButtons[viewName].classList.add('active');
}

function closeModal(modalName) {
    const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal'), bedTransfer: document.getElementById('bed-transfer-modal') };
    if (modals[modalName]) modals[modalName].style.display = 'none';
}

function openPatientModal(patient, wardName) {
    const form = document.getElementById('patient-form');
    const modal = document.getElementById('patient-modal');
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
        form.elements['comorbidities'].value = patient.comorbidities || '';
        form.elements['short-history'].value = patient.shortHistory;
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

function openBedTransferModal(patient) {
    document.getElementById('bed-transfer-patient-name').textContent = patient.patientName;
    document.getElementById('bed-transfer-form').elements['bed-transfer-patient-id'].value = patient.id;
    document.getElementById('bed-transfer-form').elements['transfer-ward-select'].value = patient.ward;
    document.getElementById('bed-transfer-form').elements['transfer-bed-number'].value = patient.bedNumber;
    closeModal('patient');
    document.getElementById('bed-transfer-modal').style.display = 'block';
}

function archiveAndRemove(patient, collectionName, additionalData) {
    if (patient) {
        db.collection(collectionName).add({ ...patient, ...additionalData })
            .then(() => db.collection('ward_patients').doc(patient.id).delete());
    }
}

function handleDischargeAction(action, patient) {
    switch (action) {
        case 'discharge-home':
            if (confirm(`Confirm discharge for ${patient.patientName}?`)) {
                archiveAndRemove(patient, 'ward_discharged', { dischargeTime: new Date().toISOString() });
                closeModal('actions');
            }
            break;
        case 'transfer':
            openHospitalTransferModal(patient);
            break;
        case 'lama':
            if (confirm("Confirm LAMA?")) {
                archiveAndRemove(patient, 'ward_lama_dor', { status: 'LAMA', eventTime: new Date().toISOString() });
                closeModal('actions');
            }
            break;
        case 'dor':
            if (confirm("Confirm DOR?")) {
                archiveAndRemove(patient, 'ward_lama_dor', { status: 'DOR', eventTime: new Date().toISOString() });
                closeModal('actions');
            }
            break;
    }
}

function renderWards() {
    const wardBoardContainer = document.getElementById('ward-board-view');
    wardBoardContainer.innerHTML = '';
    wardsConfig.forEach(wardInfo => {
        const wardName = wardInfo.name;
        const occupiedBeds = allData.active.filter(p => p.ward === wardName).length;
        const freeBeds = wardInfo.totalBeds > 0 ? wardInfo.totalBeds - occupiedBeds : 'N/A';
        let occupancyHTML = '';
        if (wardInfo.totalBeds > 0) {
            occupancyHTML = `<span class="ward-occupancy">Occupied: <strong>${occupiedBeds}</strong> | Free: <strong>${freeBeds}</strong></span>`;
        }
        const wardSection = document.createElement('div');
        wardSection.className = 'ward-section';
        wardSection.innerHTML = `<div class="ward-header"><h2>${wardName}</h2>${occupancyHTML}<button class="admit-btn" data-ward="${wardName}"><i class="fa-solid fa-user-plus"></i> Admit New Patient</button></div><div class="bed-grid" id="grid-${wardName.replace(/\s+/g, '-')}"></div>`;
        wardBoardContainer.appendChild(wardSection);
    });
    renderAllPatients();
}

function renderAllPatients() {
    document.querySelectorAll('.bed-grid').forEach(grid => grid.innerHTML = '');
    wardsConfig.forEach(wardInfo => {
        const wardPatients = allData.active.filter(p => p.ward === wardInfo.name).sort((a, b) => (parseInt(a.bedNumber.match(/\d+/g)) || 0) - (parseInt(b.bedNumber.match(/\d+/g)) || 0));
        const gridId = `grid-${wardInfo.name.replace(/\s+/g, '-')}`;
        const patientGrid = document.getElementById(gridId);
        if (patientGrid) {
            if (wardPatients.length === 0) { patientGrid.innerHTML = `<p class="empty-ward-message">No patients in this ward.</p>`; } else {
                wardPatients.forEach(patient => {
                    const patientCard = document.createElement('div');
                    patientCard.className = 'patient-card';
                    patientCard.dataset.id = patient.id;
                    patientCard.innerHTML = `<div class="patient-card-header"><span class="bed-number">Bed: ${patient.bedNumber}</span><span class="patient-name">${patient.patientName}</span></div><div class="patient-info"><p><i class="fa-solid fa-cake-candles"></i><strong>Age/Sex:</strong> ${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</p><p><i class="fa-solid fa-calendar-day"></i><strong>Adm. Date:</strong> ${new Date(patient.admissionDate).toLocaleDateString()}</p><p><i class="fa-solid fa-notes-medical"></i><strong>Comorbidities:</strong> ${patient.comorbidities || 'N/A'}</p><p><i class="fa-solid fa-file-medical"></i><strong>History:</strong> ${patient.shortHistory || 'N/A'}</p><p><i class="fa-solid fa-stethoscope"></i><strong>Diagnosis:</strong> ${patient.diagnosis || 'N/A'}</p><p><i class="fa-solid fa-clipboard-list"></i><strong>Ongoing Mgt:</strong> ${patient.ongoingManagement || 'N/A'}</p></div><div class="card-actions"><button class="card-action-btn edit" data-action="edit"><i class="fa-solid fa-pen-to-square"></i> Details</button><button class="card-action-btn discharge" data-action="discharge"><i class="fa-solid fa-right-from-bracket"></i> Actions</button></div>`;
                    patientGrid.appendChild(patientCard);
                });
            }
        }
    });
}

function setupRealtimeListeners() {
    const createListener = (collection, orderField, key) => {
        const tableBodies = { discharged: document.getElementById('discharged-table-body'), transferred: document.getElementById('transferred-table-body'), lama: document.getElementById('lama-table-body'), };
        db.collection(collection).orderBy(orderField, 'desc').onSnapshot(snapshot => {
            allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList(key, tableBodies);
            updateStatsForDate();
        });
    };
    db.collection('ward_patients').orderBy('ward').orderBy('bedNumber').onSnapshot(snapshot => {
        allData.active = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderWards();
        updateStatsForDate();
    }, err => {
        console.error("FirebaseError: This query likely needs a composite index. Please click the link in the console to create it.", err);
    });
    createListener('ward_discharged', 'dischargeTime', 'discharged');
    createListener('ward_transferred', 'transferTime', 'transferred');
    createListener('ward_lama_dor', 'eventTime', 'lama');
}

function renderList(key, tableBodies) {
    const searchBars = { discharged: document.getElementById('search-discharged'), transferred: document.getElementById('search-transferred'), lama: document.getElementById('search-lama'), };
    const tbody = tableBodies[key];
    const items = allData[key];
    const getRowRenderer = (rendererKey) => {
        const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A';
        switch(rendererKey) {
            case 'discharged': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`;
            case 'transferred': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.transferredTo}</td><td>${formatTime(item.transferTime)}</td>`;
            case 'lama': return item => `<td>${item.patientName}</td><td>${item.bedNumber}</td><td>${item.ward}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td>`;
            default: return () => '';
        }
    };
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
            const row = document.createElement('tr');
            row.innerHTML = renderRowFunc(item);
            tbody.appendChild(row);
        });
    }
}

function updateStatsForDate() {
    const statsView = document.getElementById('stats-view');
    if (!statsView) return;
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display'), };
    if (!statsNav.dateDisplay) return;
    
    const localDate = new Date(statsCurrentDate);
    localDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    statsNav.dateDisplay.textContent = localDate.getTime() === today.getTime() ? 'Today' : localDate.toLocaleDateString('en-CA');
    statsNav.nextDay.disabled = localDate.getTime() >= today.getTime();
    
    const medicalWardInfo = wardsConfig.find(w => w.name === "Medical Ward");
    const occupiedMedical = allData.active.filter(p => p.ward === "Medical Ward").length;
    const vacantMedical = medicalWardInfo.totalBeds - occupiedMedical;
    document.getElementById('stats-occupied').textContent = occupiedMedical;
    document.getElementById('stats-vacant').textContent = vacantMedical;

    const getShiftTimestamps = date => { const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0); return { shift3_start: startOfDay, shift1_start: new Date(startOfDay.getTime() + 8 * 60 * 60 * 1000), shift2_start: new Date(startOfDay.getTime() + 16 * 60 * 60 * 1000), endOfDay: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) }; };
    const dailyTimestamps = getShiftTimestamps(localDate);
    const filterByShift = (list, timeField, start, end) => list.filter(item => { const itemTime = new Date(item[timeField]); return itemTime >= start && itemTime < end; });
    
    const allArchivedTypes = { admitted: 'admissionDate', discharged: 'dischargeTime', transferred: 'transferTime', lama: 'eventTime' };
    const calculateShiftStats = (start, end) => {
        let total = 0;
        const admittedPatients = allData.active.filter(p => new Date(p.admissionDate) >= start && new Date(p.admissionDate) < end);
        total += admittedPatients.length;
        
        const dischargedPatients = filterByShift(allData.discharged, 'dischargeTime', start, end);
        total += dischargedPatients.length;
        
        return { total };
    };

    const s1Stats = calculateShiftStats(dailyTimestamps.shift1_start, dailyTimestamps.shift2_start);
    const s2Stats = calculateShiftStats(dailyTimestamps.shift2_start, dailyTimestamps.endOfDay);
    const s3Stats = calculateShiftStats(dailyTimestamps.shift3_start, dailyTimestamps.shift1_start);

    document.getElementById('stats-s1-total').textContent = s1Stats.total;
    document.getElementById('stats-s2-total').textContent = s2Stats.total;
    document.getElementById('stats-s3-total').textContent = s3Stats.total;
}
