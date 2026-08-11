// ============================================================
// FIREBASE CONFIG — paste your own project's values here.
// Get these from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDpwdRTx9AX-oKNOCltiWAdZns6Wy2SwG4",
  authDomain: "family-trip-manager-54947.firebaseapp.com",
  projectId: "family-trip-manager-54947",
  storageBucket: "family-trip-manager-54947.firebasestorage.app",
  messagingSenderId: "353657835510",
  appId: "1:353657835510:web:a4cf5ef6637a6e833f41d7"
};

// A short, fixed suffix appended to every 4-digit PIN before it's sent to
// Firebase Auth, purely because Firebase requires passwords of 6+
// characters. Coordinators still only ever type their 4-digit PIN.
// Change this to any string you like before you deploy (do it once,
// before creating any coordinators — changing it later breaks existing logins).
const PIN_SALT = "TRP26";

