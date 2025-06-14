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
        window.location.href = '../login.html'; // Assuming login is in the parent directory
    }
});

// --- MAIN APP FUNCTION ---
function initializeApp() {

    // --- DOM ELEMENTS ---
    const erBoard = document.getElementById('er-board');
    const signOutBtn = document.getElementById('sign-out-btn');
    const modals = { patient: document.getElementById('patient-modal'), admit: document.getElementById('admit-modal'), transfer: document.getElementById('transfer-modal'), bedTransfer: document.getElementById('bed-transfer-modal') };
    const forms = { patient: document.getElementById('patient-form'), admit: document.getElementById('admit-form'), transfer: document.getElementById('transfer-form'), bedTransfer: document.getElementById('bed-transfer-form') };
    const views = {}, navButtons = {}, tableBodies = {}, searchBars = {};
    const statsNav = { prevDay: document.getElementById('stats-prev-day'), nextDay: document.getElementById('stats-next-day'), dateDisplay: document.getElementById('stats-date-display') };

    ['board', 'discharged', 'admitted', 'transfer', 'lama', 'stats'].forEach(key => {
        views[key] = document.getElementById(`${key}-view`) || document.getElementById('er-board');
        navButtons[key] = document.getElementById(`nav-${key}`);
        if (key !== 'board' && key !== 'stats') {
            tableBodies[key] = document.querySelector(`#${key}-table tbody`);
            searchBars[key] = document.getElementById(`search-${key}`);
        }
    });

    // --- NEW: Professional SVG Icons ---
    const icons = {
        vacant: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"></path><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"></path></svg>`,
        user: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path></svg>`,
        age: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"></path></svg>`,
        hospital: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path fill-rule="evenodd" d="M8.5 10a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V14a.5.5 0 0 1-1 0v-1.5H6a.5.5 0 0 1 0-1h1.5V10.5a.5.5 0 0 1 .5-.5z"></path><path d="M1 1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V1zm1 0v13h12V1H2z"></path><path d="M5 5.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"></path></svg>`,
        id: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v7A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 3h-13zM1 4.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-7z"></path><path d="M2 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1zm0 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-1zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1zm10-1.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-4z"></path></svg>`,
        clock: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"></path><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"></path></svg>`,
        nurse: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M8.5 6.027a.5.5 0 1 0-1 0V7H6.5a.5.5 0 1 0 0 1H7.5v.973a.5.5 0 1 0 1 0V8H9.5a.5.5 0 1 0 0-1H8.5V6.027z"></path><path d="M14 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12zM2 4v8h12V4H2z"></path></svg>`,
        doctor: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path d="M2.5 8.25A.75.75 0 0 1 3.25 7h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 8.25zm0 2.5a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75zM3.25 5h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1 0-1.5z"></path></svg>`,
        dx: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"></path><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"></path></svg>`,
        plan: `<svg fill="currentColor" class="info-icon" viewBox="0 0 16 16" height="1em" width="1em"><path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3.854 2.146a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L2 3.293l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L2 7.293l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L2 11.293l1.146-1.147a.5.5 0 0 1 .708 0z"></path></svg>`
    };
    
    // --- STATE MANAGEMENT ---
    const bedsConfig = [ { number: 1, zone: 'resus-zone' }, { number: 2, zone: 'red-zone' }, { number: 3, zone: 'red-zone' }, { number: 4, zone: 'red-zone' }, { number: 5, zone: 'yellow-zone' }, { number: 6, zone: 'yellow-zone' }, { number: 7, zone: 'yellow-zone' }, { number: 8, zone: 'yellow-zone' }, { number: 9, zone: 'yellow-zone' }, { number: 10, zone: 'yellow-zone' }, { number: 11, zone: 'yellow-zone' }, { number: 12, zone: 'yellow-zone' }, { number: 13, zone: 'holding-bay' }, { number: 14, zone: 'holding-bay' } ];
    let allData = { active: [], discharged: [], admitted: [], transfer: [], lama: [], };
    let statsCurrentDate = new Date();

    // --- RENDER & UPDATE FUNCTIONS ---
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
                bedDiv.innerHTML = `<div class="bed-header">Bed ${bedConfig.number}</div><div class="bed-info"><p>${icons.vacant} Vacant</p></div><div class="action-buttons"></div>`;
                bedGrid.appendChild(bedDiv);
            });
            zoneContainer.appendChild(bedGrid);
            erBoard.appendChild(zoneContainer);
        }
    }

    function saveOccupancyToLocalStorage(departmentId) {
        const allBeds = document.querySelectorAll('.bed');
        let occupiedCount = 0;
        allBeds.forEach(bed => !bed.classList.contains('vacant') && occupiedCount++);
        const today = new Date();
        const dateString = today.toISOString().slice(0, 10);
        const storageKey = `hmhmo_${departmentId}_history`;
        let departmentHistory = JSON.parse(localStorage.getItem(storageKey) || '{}');
        departmentHistory[dateString] = occupiedCount;
        localStorage.setItem(storageKey, JSON.stringify(departmentHistory));
        console.log(`${departmentId} history for ${dateString}: ${occupiedCount} beds`);
    }

    function updateBedsWithData(patients) {
        allData.active = patients;
        document.querySelectorAll('.bed').forEach(bedDiv => {
            bedDiv.classList.add('vacant');
            bedDiv.querySelector('.bed-info').innerHTML = `<p>${icons.vacant} Vacant</p>`;
            bedDiv.querySelector('.action-buttons').innerHTML = '';
        });
        patients.forEach(patient => {
            const bedDiv = document.getElementById(`bed-${patient.bedNumber}`);
            if (bedDiv) {
                bedDiv.classList.remove('vacant');
                // --- MODIFIED: Added <strong> tags for titles and new icons ---
                bedDiv.querySelector('.bed-info').innerHTML = `
                    <p>${icons.user}<strong>Name:</strong> <span class="patient-data">${patient.name||''}</span></p>
                    <p>${icons.age}<strong>Age:</strong> <span class="patient-data">${patient.age||''}</span></p>
                    <p>${icons.hospital}<strong>Hospital #:</strong> <span class="patient-data">${patient.hospitalNumber||''}</span><button class="copy-btn" data-copy="${patient.hospitalNumber||''}">Copy</button></p>
                    <p>${icons.id}<strong>ID:</strong> <span class="patient-data">${patient.idCardNumber||''}</span><button class="copy-btn" data-copy="${patient.idCardNumber||''}">Copy</button></p>
                    <p>${icons.clock}<strong>Arrival:</strong> <span class="patient-data">${new Date(patient.arrivalTime).toLocaleTimeString()}</span></p>
                    <p>${icons.nurse}<strong>Nurse:</strong> <span class="patient-data">${patient.assignedNurse||''}</span></p>
                    <p>${icons.doctor}<strong>Doctor:</strong> <span class="patient-data">${patient.assignedDoctor||''}</span></p>
                    <p>${icons.dx}<strong>Dx:</strong> <span class="patient-data">${patient.diagnosis||''}</span></p>
                    <p>${icons.plan}<strong>Plan:</strong> <span class="patient-data">${patient.plan||''}</span></p>`;
                bedDiv.querySelector('.action-buttons').innerHTML = `<button class="action-btn discharge" data-patient-id="${patient.id}" title="Discharge"><i class="fa-solid fa-house-medical-circle-check"></i></button><button class="action-btn admit" data-patient-id="${patient.id}" title="Admit"><i class="fa-solid fa-hospital-user"></i></button><button class="action-btn transfer" data-patient-id="${patient.id}" title="Transfer"><i class="fa-solid fa-truck-medical"></i></button><button class="action-btn lama" data-patient-id="${patient.id}" title="Left Against Medical Advice"><i class="fa-solid fa-person-walking-arrow-right"></i> LAMA</button><button class="action-btn dor" data-patient-id="${patient.id}" title="Discharge on Request"><i class="fa-solid fa-person-walking-arrow-right"></i> DOR</button>`;
            }
        });
        saveOccupancyToLocalStorage('ER');
    }
    
    // ... (The rest of your script, including event listeners, remains unchanged) ...
    function showView(viewName) { if (viewName === 'stats') { updateStatsForDate(); } Object.values(views).forEach(view => { if(view) view.style.display = 'none' }); Object.values(navButtons).forEach(btn => { if(btn) btn.classList.remove('active') }); if(views[viewName]) views[viewName].style.display = 'block'; if(navButtons[viewName]) navButtons[viewName].classList.add('active'); }
    function updateStatsForDate() { const localDate = new Date(statsCurrentDate.getTime()); const today = new Date(); today.setHours(0,0,0,0); localDate.setHours(0,0,0,0); if(localDate.getTime() === today.getTime()){ statsNav.dateDisplay.textContent = 'Today'; } else { statsNav.dateDisplay.textContent = localDate.toLocaleDateString('en-CA'); } statsNav.nextDay.disabled = localDate.getTime() >= today.getTime(); const getShiftTimestamps = (date) => { const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0); return { shift3_start: startOfDay, shift1_start: new Date(startOfDay.getTime() + 8 * 3600000), shift2_start: new Date(startOfDay.getTime() + 16 * 3600000), endOfDay: new Date(startOfDay.getTime() + 24 * 3600000) }; }; const dailyTimestamps = getShiftTimestamps(localDate); const filterByShift = (list, timeField, start, end) => list.filter(item => { const itemTime = new Date(item[timeField]); return itemTime >= start && itemTime < end; }); const allArchivedTypes = { admissionTime: 'admitted', dischargeTime: 'discharged', transferTime: 'transfer', eventTime: 'lama'}; const calculateShiftStats = (start, end) => { let total = 0, admitted = 0, discharged = 0; for (const [timeField, type] of Object.entries(allArchivedTypes)) { const shiftData = filterByShift(allData[type], timeField, start, end); total += shiftData.length; if(type === 'admitted') admitted = shiftData.length; if(type === 'discharged') discharged = shiftData.length; } return { total, admitted, discharged }; }; const s1Stats = calculateShiftStats(dailyTimestamps.shift1_start, dailyTimestamps.shift2_start); const s2Stats = calculateShiftStats(dailyTimestamps.shift2_start, dailyTimestamps.endOfDay); const s3Stats = calculateShiftStats(dailyTimestamps.shift3_start, dailyTimestamps.shift1_start); document.getElementById('stats-s1-total').textContent = s1Stats.total; document.getElementById('stats-s1-admitted').textContent = s1Stats.admitted; document.getElementById('stats-s1-discharged').textContent = s1Stats.discharged; document.getElementById('stats-s2-total').textContent = s2Stats.total; document.getElementById('stats-s2-admitted').textContent = s2Stats.admitted; document.getElementById('stats-s2-discharged').textContent = s2Stats.discharged; document.getElementById('stats-s3-total').textContent = s3Stats.total; document.getElementById('stats-s3-admitted').textContent = s3Stats.admitted; document.getElementById('stats-s3-discharged').textContent = s3Stats.discharged; const monthStart = new Date(localDate.getFullYear(), localDate.getMonth(), 1); let monthlyTotal = 0; for (const [timeField, type] of Object.entries(allArchivedTypes)) { monthlyTotal += allData[type].filter(item => new Date(item[timeField]) >= monthStart).length; } document.getElementById('stats-monthly-total').textContent = monthlyTotal; document.getElementById('stats-monthly-range').textContent = `Since ${monthStart.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`; }
    function groupDataByShift(items, timeField) { const today = new Date(); today.setHours(0, 0, 0, 0); const shifts = { shift1: { name: 'Shift 1 (8am - 4pm)', start: new Date(today.getTime() + 8 * 3600000), end: new Date(today.getTime() + 16 * 3600000), items: [] }, shift2: { name: 'Shift 2 (4pm - 12am)', start: new Date(today.getTime() + 16 * 3600000), end: new Date(today.getTime() + 24 * 3600000), items: [] }, shift3: { name: 'Shift 3 (12am - 8am)', start: today, end: new Date(today.getTime() + 8 * 3600000), items: [] }, }; const todayItems = items.filter(item => new Date(item[timeField]) >= today); const olderItems = items.filter(item => new Date(item[timeField]) < today); todayItems.forEach(item => { const itemTime = new Date(item[timeField]); if (itemTime >= shifts.shift1.start && itemTime < shifts.shift2.start) shifts.shift1.items.push(item); else if (itemTime >= shifts.shift2.start && itemTime < shifts.shift2.end) shifts.shift2.items.push(item); else if (itemTime >= shifts.shift3.start && itemTime < shifts.shift1.start) shifts.shift3.items.push(item); }); return { shifts, olderItems }; }
    function renderList(key) { const tbody = tableBodies[key]; const items = allData[key]; const timeField = { discharged: 'dischargeTime', admitted: 'admissionTime', transfer: 'transferTime', lama: 'eventTime' }[key]; const renderRowFunc = getRowRenderer(key); const searchTerm = (searchBars[key] ? searchBars[key].value : '').toLowerCase(); if (!tbody || !items || !renderRowFunc || !timeField) return; tbody.innerHTML = ''; const filteredItems = items.filter(item => (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.idCardNumber && item.idCardNumber.toLowerCase().includes(searchTerm)) || (item.hospitalNumber && item.hospitalNumber.toLowerCase().includes(searchTerm))); const { shifts, olderItems } = groupDataByShift(filteredItems, timeField); const colspan = tbody.parentElement.querySelector('thead tr').childElementCount; Object.values(shifts).reverse().forEach(shift => { if (shift.items.length > 0) { const headerRow = tbody.insertRow(); headerRow.className = 'shift-header-row'; headerRow.innerHTML = `<td colspan="${colspan}">${shift.name}</td>`; shift.items.forEach(item => { const row = tbody.insertRow(); row.innerHTML = renderRowFunc(item); }); } }); if (olderItems.length > 0) { const headerRow = tbody.insertRow(); headerRow.className = 'shift-header-row'; headerRow.innerHTML = `<td colspan="${colspan}">Previous Days</td>`; olderItems.forEach(item => { const row = tbody.insertRow(); row.innerHTML = renderRowFunc(item); }); } if (tbody.innerHTML === '') { const row = tbody.insertRow(); row.innerHTML = `<td colspan="${colspan}" style="text-align: center; padding: 20px;">${searchTerm ? 'No matching patients found.' : 'No patients in this list.'}</td>`; } }
    function getRowRenderer(key) { const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString() : 'N/A'; switch (key) { case 'discharged': return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${formatTime(item.dischargeTime)}</td><td>${item.diagnosis}</td>`; case 'admitted': return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${formatTime(item.admissionTime)}</td><td>${item.admissionDiagnosis||''}</td><td>${item.admittedToWard}</td><td>${item.admittedToBed}</td>`; case 'transfer': return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${item.transferredTo}</td><td>${item.transferReason}</td><td>${formatTime(item.transferTime)}</td>`; case 'lama': return item => `<td>${item.name}</td><td>${item.age||''}</td><td>${item.hospitalNumber||''}</td><td>${item.status}</td><td>${formatTime(item.eventTime)}</td><td>${item.diagnosis}</td>`; default: return () => ''; } }
    function setupAllListeners() { const createListener = (collection, orderField, key) => { db.collection(collection).orderBy(orderField, 'desc').onSnapshot(snapshot => { allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); const activeView = Object.keys(views).find(v => views[v] && views[v].style.display !== 'none'); if (activeView === key) { renderList(key); } updateStatsForDate(); }, err => console.error(`Listener error for ${collection}:`, err)); }; db.collection('patients').orderBy('bedNumber', 'asc').onSnapshot(snapshot => { updateBedsWithData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); updateStatsForDate(); }, err => console.error(`Listener error for patients:`, err)); createListener('discharged_patients', 'dischargeTime', 'discharged'); createListener('admitted_patients', 'admissionTime', 'admitted'); createListener('transferred_patients', 'transferTime', 'transfer'); createListener('lama_dor_patients', 'eventTime', 'lama'); }
    function openModal(modalName, data) { const modal = modals[modalName]; if (!modal) return; if (modalName === 'patient') { const bedNumber = data.bedNumber; const patient = allData.active.find(p => p.id === data.id); document.getElementById('modal-bed-number').textContent = bedNumber; forms.patient.elements['modal-bed-id'].value = bedNumber; forms.patient.elements['modal-bed-id'].dataset.patientId = patient ? patient.id : ''; const bedTransferBtn = document.getElementById('bed-transfer-btn'); if (patient) { bedTransferBtn.style.display = 'block'; bedTransferBtn.onclick = () => openBedTransferModal(patient); } else { bedTransferBtn.style.display = 'none'; } if (patient) { forms.patient.elements['patient-name'].value = patient.name || ''; forms.patient.elements['patient-age'].value = patient.age || ''; forms.patient.elements['hospital-number'].value = patient.hospitalNumber || ''; forms.patient.elements['patient-id'].value = patient.idCardNumber || ''; forms.patient.elements['assigned-nurse'].value = patient.assignedNurse || ''; forms.patient.elements['assigned-doctor'].value = patient.assignedDoctor || ''; forms.patient.elements['diagnosis'].value = patient.diagnosis || ''; forms.patient.elements['plan'].value = patient.plan || ''; } else { forms.patient.reset(); } } else if (modalName === 'admit' || modalName === 'transfer') { document.getElementById(`${modalName}-patient-name`).textContent = data.name; document.getElementById(`${modalName}-patient-id`).value = data.id; } modal.style.display = 'block'; }
    function openBedTransferModal(patient) { const occupiedBeds = new Set(allData.active.map(p => p.bedNumber)); const vacantBeds = bedsConfig.filter(bed => !occupiedBeds.has(bed.number)); const selectElement = document.getElementById('vacant-beds-select'); selectElement.innerHTML = ''; if (vacantBeds.length === 0) { const option = document.createElement('option'); option.textContent = "No vacant beds available"; option.disabled = true; selectElement.appendChild(option); } else { vacantBeds.forEach(bed => { const option = document.createElement('option'); option.value = bed.number; option.textContent = `Bed ${bed.number} (${bed.zone.replace(/-/g, ' ')})`; selectElement.appendChild(option); }); } document.getElementById('transfer-patient-name-display').textContent = patient.name; document.getElementById('transfer-patient-id-input').value = patient.id; modals.patient.style.display = 'none'; modals.bedTransfer.style.display = 'block'; }
    function closeModal(modalName) { if (modals[modalName]) modals[modalName].style.display = 'none'; if (forms[modalName]) forms[modalName].reset(); }
    document.querySelectorAll('.modal .close-button').forEach(btn => btn.onclick = () => btn.closest('.modal').style.display = 'none' ); window.onclick = (event) => { if (event.target.classList.contains('modal')) event.target.style.display = 'none'; };
    erBoard.addEventListener('click', (e) => { if (e.target.classList.contains('copy-btn')) { const textToCopy = e.target.dataset.copy; const originalText = e.target.textContent; const tempTextArea = document.createElement('textarea'); tempTextArea.value = textToCopy; document.body.appendChild(tempTextArea); tempTextArea.select(); document.execCommand('copy'); document.body.removeChild(tempTextArea); e.target.textContent = 'Copied!'; e.target.classList.add('copied'); setTimeout(() => { e.target.textContent = originalText; e.target.classList.remove('copied'); }, 1500); return; } const bedDiv = e.target.closest('.bed'); if (!bedDiv) return; const actionButton = e.target.closest('.action-btn'); const bedNumber = parseInt(bedDiv.dataset.bedNumber); const patient = allData.active.find(p => p.bedNumber === bedNumber); if (!patient && !actionButton) { openModal('patient', { bedNumber }); return; } if (!actionButton) { openModal('patient', patient); return; } const patientId = actionButton.dataset.patientId; const patientToActOn = allData.active.find(p => p.id === patientId); const archiveAndRemove = (collectionName, additionalData) => { if (patientToActOn) { db.collection(collectionName).add({ ...patientToActOn, ...additionalData }).then(() => db.collection('patients').doc(patientId).delete()).catch(err => console.error(`Error: ${collectionName}`, err)); } }; if (actionButton.classList.contains('admit')) openModal('admit', patientToActOn); else if (actionButton.classList.contains('transfer')) openModal('transfer', patientToActOn); else if (actionButton.classList.contains('discharge') && confirm(`Discharge ${patientToActOn.name}?`)) archiveAndRemove('discharged_patients', { dischargeTime: new Date().toISOString() }); else if (actionButton.classList.contains('lama') && confirm(`${patientToActOn.name} is LAMA?`)) archiveAndRemove('lama_dor_patients', { status: 'LAMA', eventTime: new Date().toISOString() }); else if (actionButton.classList.contains('dor') && confirm(`${patientToActOn.name} is DOR?`)) archiveAndRemove('lama_dor_patients', { status: 'DOR', eventTime: new Date().toISOString() }); });
    forms.patient.addEventListener('submit', (e) => { e.preventDefault(); const bedNumber = parseInt(forms.patient.elements['modal-bed-id'].value); const patientId = forms.patient.elements['modal-bed-id'].dataset.patientId; const patientData = { bedNumber, name: forms.patient.elements['patient-name'].value, age: forms.patient.elements['patient-age'].value, hospitalNumber: forms.patient.elements['hospital-number'].value, idCardNumber: forms.patient.elements['patient-id'].value, assignedNurse: forms.patient.elements['assigned-nurse'].value, assignedDoctor: forms.patient.elements['assigned-doctor'].value, diagnosis: forms.patient.elements['diagnosis'].value, plan: forms.patient.elements['plan'].value }; if (patientId) { db.collection('patients').doc(patientId).update(patientData); } else { patientData.arrivalTime = new Date().toISOString(); db.collection('patients').add(patientData); } closeModal('patient'); });
    forms.admit.addEventListener('submit', (e) => { e.preventDefault(); const patientId = forms.admit.elements['admit-patient-id'].value; const patient = allData.active.find(p => p.id === patientId); if (patient) { const data = { admittedToWard: forms.admit.elements['admit-ward'].value, admittedToBed: forms.admit.elements['admit-bed'].value, admissionDiagnosis: forms.admit.elements['admit-diagnosis'].value, admissionTime: new Date().toISOString() }; db.collection('admitted_patients').add({ ...patient, ...data }).then(() => db.collection('patients').doc(patientId).delete()); } closeModal('admit'); });
    forms.transfer.addEventListener('submit', (e) => { e.preventDefault(); const patientId = forms.transfer.elements['transfer-patient-id'].value; const patient = allData.active.find(p => p.id === patientId); if (patient) { const data = { transferredTo: forms.transfer.elements['transfer-hospital'].value, transferReason: forms.transfer.elements['transfer-reason'].value, transferTime: new Date().toISOString() }; db.collection('transferred_patients').add({ ...patient, ...data }).then(() => db.collection('patients').doc(patientId).delete()); } closeModal('transfer'); });
    forms.bedTransfer.addEventListener('submit', (e) => { e.preventDefault(); const patientId = forms.bedTransfer.elements['transfer-patient-id-input'].value; const newBedNumber = parseInt(forms.bedTransfer.elements['vacant-beds-select'].value); if (patientId && newBedNumber) { db.collection('patients').doc(patientId).update({ bedNumber: newBedNumber }).catch(err => console.error("Bed transfer failed:", err)); } closeModal('bedTransfer'); });
    Object.keys(navButtons).forEach(key => { if(navButtons[key]) navButtons[key].addEventListener('click', () => { showView(key); if (key !== 'board' && key !== 'stats') { renderList(key); } }); }); signOutBtn.addEventListener('click', () => auth.signOut().catch(err => console.error("Sign out error:", err))); Object.keys(searchBars).forEach(key => { if(searchBars[key]) searchBars[key].addEventListener('input', () => renderList(key)); });
    statsNav.prevDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() - 1); updateStatsForDate(); });
    statsNav.nextDay.addEventListener('click', () => { statsCurrentDate.setDate(statsCurrentDate.getDate() + 1); updateStatsForDate(); });
    
    // --- INITIAL APP START ---
    drawInitialBedLayout();
    setupAllListeners();
    showView('board');
}
