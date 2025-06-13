// --- YOUR FIREBASE CONFIGURATION ---
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

// --- MAIN APP FUNCTION ---
function initializeApp() {

    // --- DOM ELEMENTS ---
    const erBoard = document.getElementById('er-board');
    const signOutBtn = document.getElementById('sign-out-btn');
    const modals = {
        patient: document.getElementById('patient-modal'),
        admit: document.getElementById('admit-modal'),
        transfer: document.getElementById('transfer-modal'),
        bedTransfer: document.getElementById('bed-transfer-modal')
    };
    const forms = {
        patient: document.getElementById('patient-form'),
        admit: document.getElementById('admit-form'),
        transfer: document.getElementById('transfer-form'),
        bedTransfer: document.getElementById('bed-transfer-form')
    };
    const views = {};
    const navButtons = {};
    const tableBodies = {};
    const searchBars = {};
    const statsNav = {
        prevDay: document.getElementById('stats-prev-day'),
        nextDay: document.getElementById('stats-next-day'),
        dateDisplay: document.getElementById('stats-date-display')
    };

    ['board', 'discharged', 'admitted', 'transfer', 'lama', 'stats'].forEach(key => {
        views[key] = document.getElementById(`${key}-view`) || document.getElementById('er-board');
        navButtons[key] = document.getElementById(`nav-${key}`);
        if (key !== 'board' && key !== 'stats') {
            tableBodies[key] = document.querySelector(`#${key}-table tbody`);
            searchBars[key] = document.getElementById(`search-${key}`);
        }
    });

    // --- STATE MANAGEMENT ---
    const bedsConfig = [ { number: 1, zone: 'resus-zone' }, { number: 2, zone: 'red-zone' }, { number: 3, zone: 'red-zone' }, { number: 4, zone: 'red-zone' }, { number: 5, zone: 'yellow-zone' }, { number: 6, zone: 'yellow-zone' }, { number: 7, zone: 'yellow-zone' }, { number: 8, zone: 'yellow-zone' }, { number: 9, zone: 'yellow-zone' }, { number: 10, zone: 'yellow-zone' }, { number: 11, zone: 'yellow-zone' }, { number: 12, zone: 'yellow-zone' }, { number: 13, zone: 'holding-bay' }, { number: 14, zone: 'holding-bay' } ];
    let allData = { active: [], discharged: [], admitted: [], transfer: [], lama: [], };
    let statsCurrentDate = new Date();

    // --- VIEW SWITCHING LOGIC ---
    function showView(viewName) {
        if (viewName === 'stats') {
            updateStatsForDate();
        }
        Object.values(views).forEach(view => { if(view) view.style.display = 'none' });
        Object.values(navButtons).forEach(btn => { if(btn) btn.classList.remove('active') });
        if(views[viewName]) views[viewName].style.display = 'block';
        if(navButtons[viewName]) navButtons[viewName].classList.add('active');
    }

    // --- STATISTICS CALCULATION ---
    function updateStatsForDate() {
        const localDate = new Date(statsCurrentDate.getTime());
        const today = new Date();
        today.setHours(0,0,0,0);
        localDate.setHours(0,0,0,0);

        if(localDate.getTime() === today.getTime()){
            statsNav.dateDisplay.textContent = 'Today';
        } else {
            statsNav.dateDisplay.textContent = localDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        }
        
        statsNav.nextDay.disabled = localDate.getTime() >= today.getTime();

        const getShiftTimestamps = (date) => {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            return {
                shift3_start: startOfDay,
                shift1_start: new Date(startOfDay.getTime() + 8 * 60 * 60 * 1000), // 8:00 AM
                shift2_start: new Date(startOfDay.getTime() + 16 * 60 * 60 * 1000), // 4:00 PM
                endOfDay: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) // 12:00 AM next day
            };
        };

        const dailyTimestamps = getShiftTimestamps(localDate);
        
        const filterByShift = (list, timeField, start, end) => list.filter(item => {
            const itemTime = new Date(item[timeField]);
            return itemTime >= start && itemTime < end;
        });

        const allArchivedTypes = { admissionTime: 'admitted', dischargeTime: 'discharged', transferTime: 'transfer', eventTime: 'lama'};

        const calculateShiftStats = (start, end) => {
            let total = 0, admitted = 0, discharged = 0;
            for (const [timeField, type] of Object.entries(allArchivedTypes)) {
                const shiftData = filterByShift(allData[type], timeField, start, end);
                total += shiftData.length;
                if(type === 'admitted') admitted = shiftData.length;
                if(type === 'discharged') discharged = shiftData.length;
            }
            return { total, admitted, discharged };
        };

        const s1Stats = calculateShiftStats(dailyTimestamps.shift1_start, dailyTimestamps.shift2_start);
        const s2Stats = calculateShiftStats(dailyTimestamps.shift2_start, dailyTimestamps.endOfDay);
        const s3Stats = calculateShiftStats(dailyTimestamps.shift3_start, dailyTimestamps.shift1_start);

        document.getElementById('stats-s1-total').textContent = s1Stats.total;
        document.getElementById('stats-s1-admitted').textContent = s1Stats.admitted;
        document.getElementById('stats-s1-discharged').textContent = s1Stats.discharged;
        document.getElementById('stats-s2-total').textContent = s2Stats.total;
        document.getElementById('stats-s2-admitted').textContent = s2Stats.admitted;
        document.getElementById('stats-s2-discharged').textContent = s2Stats.discharged;
        document.getElementById('stats-s3-total').textContent = s3Stats.total;
        document.getElementById('stats-s3-admitted').textContent = s3Stats.admitted;
        document.getElementById('stats-s3-discharged').textContent = s3Stats.discharged;
        
        const monthStart = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
        let monthlyTotal = 0;
        for (const [timeField, type] of Object.entries(allArchivedTypes)) {
             monthlyTotal += allData[type].filter(item => new Date(item[timeField]) >= monthStart).length;
        }
        document.getElementById('stats-monthly-total').textContent = monthlyTotal;
        document.getElementById('stats-monthly-range').textContent = `Since ${monthStart.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`;
    }
    
    // --- DATA RENDERING FUNCTIONS ---
    function drawInitialBedLayout() {
        erBoard.innerHTML = '';
        const zones = {};
        bedsConfig.forEach(bed => { if (!zones[bed.zone]) zones[bed.zone] = []; zones[bed.zone].push(bed); });
        for (const zoneName in zones) {
            const bedsInZone = zones[zoneName];
            const zoneContainer = document.createElement('div');
            zoneContainer.className = 'zone-container';
            const zoneTitle = document.createElement('h2');
            zoneTitle.className = 'zone-title';
            zoneTitle.textContent = zoneName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            zoneContainer.appendChild(zoneTitle);
            const bedGrid = document.createElement('div');
            bedGrid.className = 'bed-grid';
            bedsInZone.forEach(bedConfig => {
                const bedDiv = document.createElement('div');
                bedDiv.id = `bed-${bedConfig.number}`;
                bedDiv.classList.add('bed', bedConfig.zone, 'vacant');
                bedDiv.dataset.bedNumber = bedConfig.number;
                bedDiv.innerHTML = `<div class="bed-header">Bed ${bedConfig.number}</div><div class="bed-info"><p><i class="fa-solid fa-bed-pulse"></i> Vacant</p></div><div class="action-buttons"></div>`;
                bedGrid.appendChild(bedDiv);
            });
            zoneContainer.appendChild(bedGrid);
            erBoard.appendChild(zoneContainer);
        }
    }

    function updateBedsWithData(patients) {
        allData.active = patients;
        document.querySelectorAll('.bed').forEach(bedDiv => {
            bedDiv.classList.add('vacant');
            bedDiv.querySelector('.bed-info').innerHTML = '<p><i class="fa-solid fa-bed-pulse"></i> Vacant</p>';
            bedDiv.querySelector('.action-buttons').innerHTML = '';
        });
        patients.forEach(patient => {
            const bedDiv = document.getElementById(`bed-${patient.bedNumber}`);
            if (bedDiv) {
                bedDiv.classList.remove('vacant');
                bedDiv.querySelector('.bed-info').innerHTML = `<p><i class="fa-solid fa-user"></i> <strong>Name:</strong> ${patient.name||''}</p><p><i class="fa-solid fa-cake-candles"></i> <strong>Age:</strong> ${patient.age||''}</p><p><i class="fa-solid fa-hashtag"></i> <strong>Hospital #:</strong> ${patient.hospitalNumber||''}</p><p><i class="fa-solid fa-id-card"></i> <strong>ID:</strong> ${patient.idCardNumber||''}</p><p><i class="fa-solid fa-clock"></i> <strong>Arrival:</strong> ${new Date(patient.arrivalTime).toLocaleTimeString()}</p><p><i class="fa-solid fa-user-nurse"></i> <strong>Nurse:</strong> ${patient.assignedNurse||''}</p><p><i class="fa-solid fa-user-doctor"></i> <strong>Doctor:</strong> ${patient.assignedDoctor||''}</p><p><i class="fa-solid fa-file-medical"></i> <strong>Dx:</strong> ${patient.diagnosis||''}</p><p><i class="fa-solid fa-clipboard-list"></i> <strong>Plan:</strong> ${patient.plan||''}</p>`;
                bedDiv.querySelector('.action-buttons').innerHTML = `<button class="action-btn discharge" data-patient-id="${patient.id}" title="Discharge"><i class="fa-solid fa-house-medical-circle-check"></i></button><button class="action-btn admit" data-patient-id="${patient.id}" title="Admit"><i class="fa-solid fa-hospital-user"></i></button><button class="action-btn transfer" data-patient-id="${patient.id}" title="Transfer"><i class="fa-solid fa-truck-medical"></i></button><button class="action-btn lama" data-patient-id="${patient.id}" title="Left Against Medical Advice"><i class="fa-solid fa-person-walking-arrow-right"></i> LAMA</button><button class="action-btn dor" data-patient-id="${patient.id}" title="Discharge on Request"><i class="fa-solid fa-person-walking-arrow-right"></i> DOR</button>`;
            }
        });
    }

    function renderList(key) {
        const tbody = tableBodies[key];
        const items = allData[key];
        const renderRowFunc = getRowRenderer(key);
        const searchTerm = (searchBars[key] ? searchBars[key].value : '').toLowerCase();
        
        if (!tbody || !items || !renderRowFunc) return;

        tbody.innerHTML = '';
        const filteredItems = items.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchTerm)) || 
            (item.idCardNumber && item.idCardNumber.toLowerCase().includes(searchTerm)) || 
            (item.hospitalNumber && item.hospitalNumber.toLowerCase().includes(searchTerm))
        );
        if (filteredItems.length === 0) {
            const row = document.createElement('tr');
            const colspan = tbody.parentElement.querySelector('thead tr').childElementCount;
            row.innerHTML = `<td colspan="${colspan}" style="text-align: center; padding: 20px;">${searchTerm ? 'No matching patients found.' : 'No patients in this list.'}</td>`;
            tbody.appendChild(row);
            return;
        }
        filteredItems.forEach(item => { const row = document.createElement('tr'); row.innerHTML = renderRowFunc(item); tbody.appendChild(row); });
    }
    
    function getRowRenderer(key) {
        const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A';
        switch (key) {
            case 'discharged': return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`;
            case 'admitted':   return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${formatTime(item.admissionTime)}</td><td>${item.admissionDiagnosis||''}</td><td>${item.admittedToWard}</td><td>${item.admittedToBed}</td>`;
            case 'transfer':   return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${item.transferredTo}</td><td>${item.transferReason}</td><td>${formatTime(item.transferTime)}</td>`;
            case 'lama':       return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td><td>${item.diagnosis}</td>`;
            default:           return () => '';
        }
    }

    // --- REAL-TIME LISTENERS ---
    function setupAllListeners() {
        const createListener = (collection, orderField, key) => {
            db.collection(collection).orderBy(orderField, 'desc').onSnapshot(snapshot => {
                allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if(key !== 'active') renderList(key);
                updateStatsForDate();
            }, err => console.error(`Listener error for ${collection}:`, err));
        };
        db.collection('patients').orderBy('bedNumber', 'asc').onSnapshot(snapshot => {
            updateBedsWithData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            updateStatsForDate();
        }, err => console.error(`Listener error for patients:`, err));

        createListener('discharged_patients', 'dischargeTime', 'discharged');
        createListener('admitted_patients', 'admissionTime', 'admitted');
        createListener('transferred_patients', 'transferTime', 'transfer');
        createListener('lama_dor_patients', 'eventTime', 'lama');
    }

    // --- MODAL & FORM LOGIC ---
    function openModal(modalName, data) {
        const modal = modals[modalName];
        if (!modal) return;
        if (modalName === 'patient') {
            const bedNumber = data.bedNumber;
            const patient = allData.active.find(p => p.id === data.id);
            document.getElementById('modal-bed-number').textContent = bedNumber;
            forms.patient.elements['modal-bed-id'].value = bedNumber;
            forms.patient.elements['modal-bed-id'].dataset.patientId = patient ? patient.id : '';
            const bedTransferBtn = document.getElementById('bed-transfer-btn');
            if (patient) {
                bedTransferBtn.style.display = 'block';
                bedTransferBtn.onclick = () => openBedTransferModal(patient);
            } else {
                bedTransferBtn.style.display = 'none';
            }
            if (patient) {
                forms.patient.elements['patient-name'].value = patient.name || '';
                forms.patient.elements['patient-age'].value = patient.age || '';
                forms.patient.elements['hospital-number'].value = patient.hospitalNumber || '';
                forms.patient.elements['patient-id'].value = patient.idCardNumber || '';
                forms.patient.elements['assigned-nurse'].value = patient.assignedNurse || '';
                forms.patient.elements['assigned-doctor'].value = patient.assignedDoctor || '';
                forms.patient.elements['diagnosis'].value = patient.diagnosis || '';
                forms.patient.elements['plan'].value = patient.plan || '';
            } else {
                forms.patient.reset();
            }
        } else if (modalName === 'admit' || modalName === 'transfer') {
            document.getElementById(`${modalName}-patient-name`).textContent = data.name;
            document.getElementById(`${modalName}-patient-id`).value = data.id;
        }
        modal.style.display = 'block';
    }

    function openBedTransferModal(patient) {
        const occupiedBeds = new Set(allData.active.map(p => p.bedNumber));
        const vacantBeds = bedsConfig.filter(bed => !occupiedBeds.has(bed.number));
        const selectElement = document.getElementById('vacant-beds-select');
        selectElement.innerHTML = '';
        if (vacantBeds.length === 0) {
            const option = document.createElement('option');
            option.textContent = "No vacant beds available";
            option.disabled = true;
            selectElement.appendChild(option);
        } else {
            vacantBeds.forEach(bed => {
                const option = document.createElement('option');
                option.value = bed.number;
                option.textContent = `Bed ${bed.number} (${bed.zone.replace(/-/g, ' ')})`;
                selectElement.appendChild(option);
            });
        }
        document.getElementById('transfer-patient-name-display').textContent = patient.name;
        document.getElementById('transfer-patient-id-input').value = patient.id;
        modals.patient.style.display = 'none';
        modals.bedTransfer.style.display = 'block';
    }

    function closeModal(modalName) {
        if (modals[modalName]) modals[modalName].style.display = 'none';
        if (forms[modalName]) forms[modalName].reset();
    }
    
    document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none' );
    window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
    
    // --- EVENT LISTENERS ---
    erBoard.addEventListener('click', (e) => {
        const bedDiv = e.target.closest('.bed'); if (!bedDiv) return;
        const actionButton = e.target.closest('.action-btn');
        const bedNumber = parseInt(bedDiv.dataset.bedNumber);
        const patient = allData.active.find(p => p.bedNumber === bedNumber);
        if (!patient && !actionButton) { openModal('patient', { bedNumber }); return; }
        if (!actionButton) { openModal('patient', patient); return; }
        const patientId = actionButton.dataset.patientId;
        const patientToActOn = allData.active.find(p => p.id === patientId);
        const archiveAndRemove = (collectionName, additionalData) => { if (patientToActOn) { db.collection(collectionName).add({ ...patientToActOn, ...additionalData }).then(() => db.collection('patients').doc(patientId).delete()).catch(err => console.error(`Error: ${collectionName}`, err)); } };
        if (actionButton.classList.contains('admit')) openModal('admit', patientToActOn);
        else if (actionButton.classList.contains('transfer')) openModal('transfer', patientToActOn);
        else if (actionButton.classList.contains('discharge') && confirm(`Discharge ${patientToActOn.name}?`)) archiveAndRemove('discharged_patients', { dischargeTime: new Date().toISOString() });
        else if (actionButton.classList.contains('lama') && confirm(`${patientToActOn.name} is LAMA?`)) archiveAndRemove('lama_dor_patients', { status: 'LAMA', eventTime: new Date().toISOString() });
        else if (actionButton.classList.contains('dor') && confirm(`${patientToActOn.name} is DOR?`)) archiveAndRemove('lama_dor_patients', { status: 'DOR', eventTime: new Date().toISOString() });
    });

    forms.patient.addEventListener('submit', (e) => {
        e.preventDefault();
        const bedNumber = parseInt(forms.patient.elements['modal-bed-id'].value);
        const patientId = forms.patient.elements['modal-bed-id'].dataset.patientId;
        const patientData = {
            bedNumber,
            name: forms.patient.elements['patient-name'].value,
            age: forms.patient.elements['patient-age'].value,
            hospitalNumber: forms.patient.elements['hospital-number'].value,
            idCardNumber: forms.patient.elements['patient-id'].value,
            assignedNurse: forms.patient.elements['assigned-nurse'].value,
            assignedDoctor: forms.patient.elements['assigned-doctor'].value,
            diagnosis: forms.patient.elements['diagnosis'].value,
            plan: forms.patient.elements['plan'].value
        };
        if (patientId) { db.collection('patients').doc(patientId).update(patientData); } 
        else { patientData.arrivalTime = new Date().toISOString(); db.collection('patients').add(patientData); }
        closeModal('patient');
    });

    forms.admit.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.admit.elements['admit-patient-id'].value;
        const patient = allData.active.find(p => p.id === patientId);
        if (patient) {
            const data = { 
                admittedToWard: forms.admit.elements['admit-ward'].value, 
                admittedToBed: forms.admit.elements['admit-bed'].value, 
                admissionDiagnosis: forms.admit.elements['admit-diagnosis'].value,
                admissionTime: new Date().toISOString() 
            };
            db.collection('admitted_patients').add({ ...patient, ...data }).then(() => db.collection('patients').doc(patientId).delete());
        }
        closeModal('admit');
    });

    forms.transfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.transfer.elements['transfer-patient-id'].value;
        const patient = allData.active.find(p => p.id === patientId);
        if (patient) {
            const data = { transferredTo: forms.transfer.elements['transfer-hospital'].value, transferReason: forms.transfer.elements['transfer-reason'].value, transferTime: new Date().toISOString() };
            db.collection('transferred_patients').add({ ...patient, ...data }).then(() => db.collection('patients').doc(patientId).delete());
        }
        closeModal('transfer');
    });

    forms.bedTransfer.addEventListener('submit', (e) => {
        e.preventDefault();
        const patientId = forms.bedTransfer.elements['transfer-patient-id-input'].value;
        const newBedNumber = parseInt(forms.bedTransfer.elements['vacant-beds-select'].value);
        if (patientId && newBedNumber) {
            db.collection('patients').doc(patientId).update({ bedNumber: newBedNumber }).catch(err => console.error("Bed transfer failed:", err));
        }
        closeModal('bedTransfer');
    });

    // Setup Navigation Listeners
    Object.keys(navButtons).forEach(key => { if(navButtons[key]) navButtons[key].addEventListener('click', () => showView(key)); });
    signOutBtn.addEventListener('click', () => auth.signOut().catch(err => console.error("Sign out error:", err)));
    Object.keys(searchBars).forEach(key => { if(searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    
    statsNav.prevDay.addEventListener('click', () => {
        statsCurrentDate.setDate(statsCurrentDate.getDate() - 1);
        updateStatsForDate();
    });
    statsNav.nextDay.addEventListener('click', () => {
        statsCurrentDate.setDate(statsCurrentDate.getDate() + 1);
        updateStatsForDate();
    });
    
    // --- INITIAL APP START ---
    drawInitialBedLayout();
    setupAllListeners();
    showView('board');
}
