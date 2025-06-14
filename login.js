// js/login.js
document.addEventListener('DOMContentLoaded', () => {
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
    const auth = firebase.auth();

    // --- DOM ELEMENTS ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    // --- FORM SUBMISSION ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        errorMessage.textContent = ''; // Clear previous errors

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in successfully
                console.log('User signed in:', userCredential.user.email);
                // Redirect to the main dashboard
                window.location.href = 'index.html';
            })
            .catch((error) => {
                // Handle Errors here.
                console.error("Authentication failed:", error.code, error.message);
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage.textContent = 'Invalid email or password.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage.textContent = 'Please enter a valid email address.';
                        break;
                    default:
                        errorMessage.textContent = 'An error occurred. Please try again.';
                        break;
                }
            });
    });
});
