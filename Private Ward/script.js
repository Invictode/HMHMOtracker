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
const appId = firebaseConfig.projectId;
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
    const roomsConfig = {
        private: ["PVT 320", "PVT 321", "PVT 322", "PVT 325", "PVT 327", "PVT 328", "PVT 330", "PVT 331", "329A", "329B"],
        isolation: ["323", "324"]
    };

    const SOURCE_COLLECTIONS = ['ward_patients', 'peds_patients', 'surgical_patients'];
    let allPrivatePatients = []; 

    // --- DOM ELEMENT REFERENCES ---
    const signOutBtn = document.getElementById('sign-out-btn');
    const wardBoardContainer = document.getElementById('ward-board-view');

    // --- DASHBOARD TRACKING ---
    function updateDashboardData() {
        const totalRooms = roomsConfig.private.length + roomsConfig.isolation.length;
        const occupiedCount = allPrivatePatients.length;
        
        const today = new Date();
        const dateString = today.toISOString().slice(0, 10);
        
        // This key MUST match the key the main dashboard application is reading from.
        // Assuming the new card on the dashboard will have data-department="Private"
        const storageKey = 'hmhmo_Private_history'; 
        
        let departmentHistory = JSON.parse(localStorage.getItem(storageKey) || '{}');
        departmentHistory[dateString] = occupiedCount;
        
        localStorage.setItem(storageKey, JSON.stringify(departmentHistory));
        console.log(`Dashboard history for Private Ward updated for ${dateString}: ${occupiedCount} beds`);
    }


    // --- CORE LOGIC ---
    function renderBoard() {
        if (!wardBoardContainer) return;
        wardBoardContainer.innerHTML = `
            <div class="ward-section">
                <div class="ward-header"><h2><i class="fa-solid fa-door-closed"></i> Private Rooms</h2></div>
                <div class="bed-grid" id="grid-private"></div>
            </div>
            <div class="ward-section">
                <div class="ward-header"><h2><i class="fa-solid fa-biohazard"></i> Isolation Rooms</h2></div>
                <div class="bed-grid" id="grid-isolation"></div>
            </div>`;

        const privateGrid = document.getElementById('grid-private');
        const isolationGrid = document.getElementById('grid-isolation');
        
        renderRoomList(privateGrid, roomsConfig.private, allPrivatePatients);
        renderRoomList(isolationGrid, roomsConfig.isolation, allPrivatePatients);

        wardBoardContainer.style.display = 'block';
        updateDashboardData(); // Update dashboard every time the board is rendered
    }

    function renderRoomList(grid, roomList, patientList) {
        if (!grid) return;
        grid.innerHTML = '';
        
        roomList.forEach(roomNumber => {
            const patient = patientList.find(p => p.bedNumber === roomNumber);
            const card = document.createElement('div');
            card.className = `patient-card ${patient ? '' : 'vacant'}`;
            
            if (patient) {
                const deptClass = `dept-${(patient.department || 'default').toLowerCase().replace(/\s/g, '-')}`;
                card.innerHTML = `
                    <div class="patient-card-header">
                        <span class="bed-number">Room: ${patient.bedNumber}</span>
                        <div>
                            <span class="patient-name">${patient.patientName}</span>
                            <span class="department-tag ${deptClass}">${patient.department || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="patient-info">
                        <p><strong>Age/Sex:</strong> ${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</p>
                        <p><strong>Diagnosis:</strong> ${patient.diagnosis || 'N/A'}</p>
                        <p><strong>Plan/Issues:</strong> ${patient.plan || patient.issues || 'N/A'}</p>
                    </div>`;
            } else {
                card.innerHTML = `<div class="patient-card-header"><span class="bed-number">Room: ${roomNumber}</span><span class="patient-name">Vacant</span></div>`;
            }
            grid.appendChild(card);
        });
    }

    // --- REALTIME DATA AGGREGATION ---
    function setupRealtimeListeners() {
        const basePath = `/artifacts/${appId}/public/data/`;
        let sourceData = {}; 

        SOURCE_COLLECTIONS.forEach(collectionName => {
            sourceData[collectionName] = []; 
            
            db.collection(`${basePath}${collectionName}`).where("ward", "in", ["Private Ward", "PVT"])
                .onSnapshot(snapshot => {
                    sourceData[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: collectionName }));
                    
                    allPrivatePatients = Object.values(sourceData).flat();
                    
                    renderBoard();
                }, err => {
                    console.error(`Error listening to ${collectionName}: `, err);
                });
        });
    }

    // --- INITIALIZATION ---
    if (signOutBtn) signOutBtn.addEventListener('click', () => auth.signOut());
    
    renderBoard();
    setupRealtimeListeners();
}
