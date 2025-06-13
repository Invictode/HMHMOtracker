/**
 * script.js for Pediatrics Patient Tracker
 *
 * This version uses a multi-view layout (Ward Board, Discharged, etc.)
 * and a different data model for handling patient status.
 * It now includes a fully functional, date-navigable statistics page,
 * and working Discharged, Transferred, and LAMA/DOR views with search.
 *
 * Firebase configuration is hardcoded as per user's request.
 */

document.addEventListener('DOMContentLoaded', () => {

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
        // Display a permanent error on the screen if Firebase fails
        const body = document.querySelector('body');
        if(body) {
            body.innerHTML = '<div style="color: red; font-family: sans-serif; padding: 20px;">FATAL ERROR: Firebase initialization failed. Check console for details.</div>';
        }
        return;
    }

    // --- GLOBAL APP STATE & CONFIG ---
    const wardsConfig = [
        { name: "Pediatric Ward", beds: ["22", "23", "24", "25", "26", "27"] }
    ];
    const DB_COLLECTIONS = {
        active: 'peds_patients',
        discharged: 'peds_discharged',
        transferred: 'peds_transferred',
        lamaDor: 'peds_lama_dor'
    };
    let allData = { active: [], discharged: [], transferred: [], lamaDor: [] };
    let statsDateOffset = 0; // 0 for today, 1 for yesterday, etc.

    // --- AUTHENTICATION CHECK ---
    auth.onAuthStateChanged(user => {
        if (user) {
            initializeApp();
        } else {
            // If not on the login page, redirect
            if(window.location.pathname.indexOf('login.html') === -1) {
                window.location.href = 'login.html';
            }
        }
    });

    // --- HELPER FUNCTIONS (Defined Globally) ---

    function showView(viewName) {
        const views = { 
            board: document.getElementById('ward-board-view'), 
            discharged: document.getElementById('discharged-view'), 
            transferred: document.getElementById('transferred-view'), 
            lama: document.getElementById('lama-view'),
            statistics: document.getElementById('stats-view')
        };
        const navButtons = { 
            board: document.getElementById('nav-board'), 
            discharged: document.getElementById('nav-discharged'), 
            transferred: document.getElementById('nav-transferred'), 
            lama: document.getElementById('nav-lama'),
            statistics: document.getElementById('nav-stats')
        };
        Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
        Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
        if (views[viewName]) views[viewName].style.display = 'block';
        if (navButtons[viewName]) navButtons[viewName].classList.add('active');

        if (viewName === 'statistics') {
            statsDateOffset = 0;
            renderStatistics(allData.active);
        } else if (viewName === 'discharged') {
            renderDischargedList();
        } else if (viewName === 'transferred') {
            renderTransferredList();
        } else if (viewName === 'lama') {
            renderLamaDorList();
        }
    }

    function closeModal(modalName) {
        const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal') };
        if (modals[modalName]) modals[modalName].style.display = 'none';
    }

    function openPatientModal(patient, wardName, bedNumber) {
        const form = document.getElementById('patient-form');
        const modal = document.getElementById('patient-modal');
        if (!form || !modal) return;
        form.reset();
        document.getElementById('modal-title').textContent = patient ? `Edit Patient - Bed ${patient.bedNumber}` : `Admit Patient to ${wardName}`;
        form.elements['patient-id-input'].value = patient ? patient.id : '';
        form.elements['ward-name-input'].value = patient ? patient.ward : wardName;
        form.elements['bed-number'].value = patient ? patient.bedNumber : bedNumber || '';
        if (patient) {
            form.elements['patient-name'].value = patient.patientName || '';
            form.elements['patient-age'].value = patient.age || '';
            form.elements['patient-sex'].value = patient.sex || 'Male';
            form.elements['patient-weight'].value = patient.weight || '';
            form.elements['immunization-status'].value = patient.immunizationStatus || '';
            form.elements['comorbidities'].value = patient.comorbidities || '';
            form.elements['diagnosis'].value = patient.diagnosis || '';
            form.elements['plan'].value = patient.plan || '';
        }
        modal.style.display = 'block';
    }

    function openActionsModal(patient) {
        const modal = document.getElementById('actions-modal');
        if (!modal) return;
        document.getElementById('actions-patient-name').textContent = patient.patientName;
        modal.dataset.patientId = patient.id;
        modal.style.display = 'block';
    }

    function openHospitalTransferModal(patient) {
        const modal = document.getElementById('hospital-transfer-modal');
        if (!modal) return;
        document.getElementById('hospital-transfer-patient-name').textContent = patient.patientName;
        document.getElementById('hospital-transfer-form').elements['hospital-transfer-patient-id'].value = patient.id;
        closeModal('actions');
        modal.style.display = 'block';
    }

    function archiveAndRemove(patient, collectionName, additionalData) {
        if (patient) {
            db.collection(collectionName).add({ ...patient, ...additionalData })
                .then(() => db.collection(DB_COLLECTIONS.active).doc(patient.id).delete());
        }
    }

    function handleDischargeAction(action, patient) {
        switch (action) {
            case 'discharge-home':
                if (confirm(`Confirm discharge for ${patient.patientName}?`)) {
                    archiveAndRemove(patient, DB_COLLECTIONS.discharged, { dischargeTime: new Date().toISOString() });
                    closeModal('actions');
                }
                break;
            case 'transfer':
                openHospitalTransferModal(patient);
                break;
            case 'lama':
                if (confirm("Confirm LAMA?")) {
                    archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'LAMA', eventTime: new Date().toISOString() });
                    closeModal('actions');
                }
                break;
            case 'dor':
                if (confirm("Confirm DOR?")) {
                    archiveAndRemove(patient, DB_COLLECTIONS.lamaDor, { status: 'DOR', eventTime: new Date().toISOString() });
                    closeModal('actions');
                }
                break;
        }
    }

    function renderWards() {
        const wardBoardContainer = document.getElementById('ward-board-view');
        if (!wardBoardContainer) return;
        wardBoardContainer.innerHTML = '';
        wardsConfig.forEach(wardInfo => {
            const wardSection = document.createElement('div');
            wardSection.className = 'ward-section';
            wardSection.innerHTML = `<div class="ward-header"><h2><i class="fa-solid fa-child-reaching"></i> ${wardInfo.name}</h2><button class="admit-btn" data-ward="${wardInfo.name}"><i class="fa-solid fa-user-plus"></i> Admit Patient</button></div><div class="bed-grid" id="grid-${wardInfo.name.replace(/\s+/g, '-')}"></div>`;
            wardBoardContainer.appendChild(wardSection);
        });
        renderAllPatients();
    }

    function renderAllPatients() {
        document.querySelectorAll('.bed-grid').forEach(grid => grid.innerHTML = '');
        wardsConfig.forEach(wardInfo => {
            const wardPatients = allData.active.filter(p => p.ward === wardInfo.name);
            const gridId = `grid-${wardInfo.name.replace(/\s+/g, '-')}`;
            const patientGrid = document.getElementById(gridId);
            
            if (patientGrid) {
                wardInfo.beds.forEach(bedNumber => {
                    const patient = wardPatients.find(p => p.bedNumber === bedNumber);
                    const card = document.createElement('div');
                    card.className = `patient-card ${patient ? '' : 'vacant'}`;
                    if (patient) card.dataset.id = patient.id;
                    else { card.dataset.ward = wardInfo.name; card.dataset.bed = bedNumber; }
                    card.innerHTML = patient ? `
                        <div class="patient-card-header"><span class="bed-number">Bed: ${patient.bedNumber}</span><span class="patient-name">${patient.patientName}</span></div>
                        <div class="patient-info">
                            <p><strong>Age/Sex:</strong> ${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</p>
                            <p><strong>Weight:</strong> ${patient.weight ? patient.weight + ' kg' : 'N/A'}</p>
                            <p><strong>Immunization:</strong> ${patient.immunizationStatus || 'N/A'}</p>
                            <p><strong>Comorbidities:</strong> ${patient.comorbidities || 'N/A'}</p>
                            <p><strong>Diagnosis:</strong> ${patient.diagnosis || 'N/A'}</p>
                            <p><strong>Plan:</strong> ${patient.plan || 'N/A'}</p>
                        </div>
                        <div class="card-actions">
                            <button class="card-action-btn edit" data-action="edit"><i class="fa-solid fa-pen-to-square"></i> Details</button>
                            <button class="card-action-btn discharge" data-action="discharge"><i class="fa-solid fa-right-from-bracket"></i> Actions</button>
                        </div>` : `<div class="patient-card-header"><span class="bed-number">Bed: ${bedNumber}</span><span class="patient-name">Vacant</span></div>`;
                    patientGrid.appendChild(card);
                });
            }
        });
    }

    // --- ARCHIVED LIST RENDERING ---
    function renderDischargedList(filter = '') {
        const tableBody = document.getElementById('discharged-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const filteredData = allData.discharged.filter(p => p.patientName.toLowerCase().includes(filter.toLowerCase()));
        filteredData.forEach(p => {
            const row = tableBody.insertRow();
            row.innerHTML = `<td>${p.patientName}</td><td>${p.bedNumber}</td><td>${new Date(p.dischargeTime).toLocaleString()}</td><td>${p.diagnosis}</td>`;
        });
    }

    function renderTransferredList(filter = '') {
        const tableBody = document.getElementById('transferred-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const filteredData = allData.transferred.filter(p => p.patientName.toLowerCase().includes(filter.toLowerCase()));
        filteredData.forEach(p => {
            const row = tableBody.insertRow();
            row.innerHTML = `<td>${p.patientName}</td><td>${p.bedNumber}</td><td>${p.transferredTo}</td><td>${new Date(p.transferTime).toLocaleString()}</td>`;
        });
    }

    function renderLamaDorList(filter = '') {
        const tableBody = document.getElementById('lama-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const filteredData = allData.lamaDor.filter(p => p.patientName.toLowerCase().includes(filter.toLowerCase()));
        filteredData.forEach(p => {
            const row = tableBody.insertRow();
            row.innerHTML = `<td>${p.patientName}</td><td>${p.bedNumber}</td><td>${p.status}</td><td>${new Date(p.eventTime).toLocaleString()}</td>`;
        });
    }


    // --- STATISTICS FUNCTIONALITY ---
    function renderStatistics() {
        const s1_total_El = document.getElementById('stats-s1-total');
        const s2_total_El = document.getElementById('stats-s2-total');
        const s3_total_El = document.getElementById('stats-s3-total');
        const dateDisplayEl = document.getElementById('stats-date-display');
        const nextDayBtn = document.getElementById('stats-next-day');

        if (!s1_total_El || !s2_total_El || !s3_total_El || !dateDisplayEl) { return; }

        const shifts = { s1: { start: 8, end: 15 }, s2: { start: 16, end: 23 }, s3: { start: 0, end: 7 } };
        const shiftCounts = { s1: 0, s2: 0, s3: 0 };
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const targetDate = new Date(today.getTime() - (statsDateOffset * 24 * 60 * 60 * 1000));
        const startOfStatDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 8, 0, 0, 0);
        const endOfStatDay = new Date(startOfStatDay.getTime() + 24 * 60 * 60 * 1000);

        allData.active.forEach(patient => {
            if (patient.admissionDate) {
                const admissionDate = new Date(patient.admissionDate);
                 if (admissionDate >= startOfStatDay && admissionDate < endOfStatDay) {
                    const admissionHour = admissionDate.getHours();
                    if (admissionHour >= shifts.s1.start && admissionHour <= shifts.s1.end) shiftCounts.s1++;
                    else if (admissionHour >= shifts.s2.start && admissionHour <= shifts.s2.end) shiftCounts.s2++;
                    else if (admissionHour >= shifts.s3.start && admissionHour <= shifts.s3.end) shiftCounts.s3++;
                }
            }
        });
        
        s1_total_El.textContent = shiftCounts.s1; s2_total_El.textContent = shiftCounts.s2; s3_total_El.textContent = shiftCounts.s3;
        if (statsDateOffset === 0) dateDisplayEl.textContent = "Today";
        else if (statsDateOffset === 1) dateDisplayEl.textContent = "Yesterday";
        else dateDisplayEl.textContent = targetDate.toLocaleDateString();
        if (nextDayBtn) nextDayBtn.disabled = (statsDateOffset <= 0);
    }

    function setupRealtimeListeners() {
        db.collection(DB_COLLECTIONS.active).onSnapshot(snapshot => {
            allData.active = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllPatients();
            if (document.getElementById('stats-view')?.style.display === 'block') renderStatistics();
        });
        db.collection(DB_COLLECTIONS.discharged).onSnapshot(snapshot => {
            allData.discharged = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('discharged-view')?.style.display === 'block') renderDischargedList();
        });
        db.collection(DB_COLLECTIONS.transferred).onSnapshot(snapshot => {
            allData.transferred = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('transferred-view')?.style.display === 'block') renderTransferredList();
        });
        db.collection(DB_COLLECTIONS.lamaDor).onSnapshot(snapshot => {
            allData.lamaDor = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('lama-view')?.style.display === 'block') renderLamaDorList();
        });
    }

    // --- MAIN APP INITIALIZATION ---
    function initializeApp() {
        const mainContent = document.getElementById('main-content');
        const modals = { patient: document.getElementById('patient-modal'), actions: document.getElementById('actions-modal'), hospitalTransfer: document.getElementById('hospital-transfer-modal') };
        const forms = { patient: document.getElementById('patient-form'), hospitalTransfer: document.getElementById('hospital-transfer-form') };
        const signOutBtn = document.getElementById('sign-out-btn');
        const navButtons = { board: document.getElementById('nav-board'), discharged: document.getElementById('nav-discharged'), transferred: document.getElementById('nav-transferred'), lama: document.getElementById('nav-lama'), statistics: document.getElementById('nav-stats') };
        const statsPrevBtn = document.getElementById('stats-prev-day');
        const statsNextBtn = document.getElementById('stats-next-day');
        
        // --- EVENT LISTENERS ---
        if (mainContent) mainContent.addEventListener('click', e => {
            const admitButton = e.target.closest('.admit-btn');
            if (admitButton) { openPatientModal(null, admitButton.dataset.ward, ''); return; }
            const card = e.target.closest('.patient-card');
            if (card && card.dataset.id) {
                const patient = allData.active.find(p => p.id === card.dataset.id);
                const actionBtn = e.target.closest('.card-action-btn');
                if (actionBtn && patient) {
                    const action = actionBtn.dataset.action;
                    if (action === 'edit') openPatientModal(patient);
                    else if (action === 'discharge') openActionsModal(patient);
                } else if (patient) openPatientModal(patient);
            } else if (card && !card.dataset.id) openPatientModal(null, card.dataset.ward, card.dataset.bed);
        });
        
        if (modals.actions) modals.actions.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-modal-btn');
            if (!actionBtn) return;
            const patientId = modals.actions.dataset.patientId;
            const patient = allData.active.find(p => p.id === patientId);
            if(patient) handleDischargeAction(actionBtn.dataset.action, patient);
        });

        if (forms.patient) forms.patient.addEventListener('submit', e => {
            e.preventDefault();
            const patientId = document.getElementById('patient-id-input').value;
            const patientData = {
                ward: "Pediatric Ward", bedNumber: document.getElementById('bed-number').value,
                patientName: document.getElementById('patient-name').value, age: document.getElementById('patient-age').value,
                sex: document.getElementById('patient-sex').value, weight: document.getElementById('patient-weight').value,
                immunizationStatus: document.getElementById('immunization-status').value, comorbidities: document.getElementById('comorbidities').value,
                diagnosis: document.getElementById('diagnosis').value, plan: document.getElementById('plan').value,
            };
            if (patientId) db.collection(DB_COLLECTIONS.active).doc(patientId).update(patientData).then(() => closeModal('patient'));
            else {
                patientData.admissionDate = new Date().toISOString();
                db.collection(DB_COLLECTIONS.active).add(patientData).then(() => closeModal('patient'));
            }
        });
        
        if (forms.hospitalTransfer) forms.hospitalTransfer.addEventListener('submit', (e) => {
            e.preventDefault();
            const patientId = forms.hospitalTransfer.elements['hospital-transfer-patient-id'].value;
            const hospital = forms.hospitalTransfer.elements['transfer-hospital'].value;
            const patient = allData.active.find(p => p.id === patientId);
            if (patient && hospital) archiveAndRemove(patient, DB_COLLECTIONS.transferred, { transferredTo: hospital, transferTime: new Date().toISOString() });
            closeModal('hospitalTransfer');
        });

        document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none');
        window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
        if (signOutBtn) signOutBtn.addEventListener('click', () => auth.signOut());
        Object.keys(navButtons).forEach(key => { if (navButtons[key]) navButtons[key].addEventListener('click', () => showView(key)); });
        
        // Stats navigation
        if(statsPrevBtn) statsPrevBtn.addEventListener('click', () => { statsDateOffset++; renderStatistics(); });
        if(statsNextBtn) statsNextBtn.addEventListener('click', () => { if (statsDateOffset > 0) { statsDateOffset--; renderStatistics(); } });

        // Search bars
        document.getElementById('search-discharged')?.addEventListener('input', e => renderDischargedList(e.target.value));
        document.getElementById('search-transferred')?.addEventListener('input', e => renderTransferredList(e.target.value));
        document.getElementById('search-lama')?.addEventListener('input', e => renderLamaDorList(e.target.value));

        // --- INITIALIZATION ---
        renderWards();
        setupRealtimeListeners();
        showView('board');
    }
});
