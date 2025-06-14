// js/auth.js

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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- GLOBAL AUTH AND DB REFERENCES ---
const auth = firebase.auth();
const db = firebase.firestore();

/**
 * Protects a page and resolves with the user's role.
 * If not logged in, redirects to login.html.
 * @returns {Promise<{user: firebase.User, role: string}>} A promise that resolves with the user object and their role ('editor' or 'viewer').
 */
function protectPage() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe(); // Stop listening to avoid multiple calls
            if (user) {
                // User is signed in, now get their custom claims (role).
                // We pass `true` to force a refresh and get the latest claims.
                user.getIdTokenResult(true)
                    .then(idTokenResult => {
                        // The role is stored in the 'claims' object.
                        // We default to 'viewer' if no role has been set for the user.
                        const role = idTokenResult.claims.role || 'viewer'; 
                        console.log(`Auth check: User ${user.email} logged in with role: ${role}`);
                        resolve({ user, role }); // Resolve with both user and role
                    })
                    .catch(error => {
                        console.error("Error getting user role:", error);
                        // If we can't get the role, treat them as a viewer for safety.
                        resolve({ user, role: 'viewer' });
                    });
            } else {
                // No user is signed in.
                console.log('Auth check: No user found. Redirecting to login.');
                window.location.href = 'login.html';
                reject('No user logged in');
            }
        });
    });
}
