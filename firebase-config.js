// ============================================================
// FIREBASE CONFIG — paste your own project's values here.
// Get these from: Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyC41vZEWGqF3gq0wDwalvTT18CgjmeQ0nw",
  authDomain: "family-trip-26-862fa.firebaseapp.com",
  projectId: "family-trip-26-862fa",
  storageBucket: "family-trip-26-862fa.firebasestorage.app",
  messagingSenderId: "972492502233",
  appId: "1:972492502233:web:70e25159e3ecebab3dbac8"
};

// A short, fixed suffix appended to every 4-digit PIN before it's sent to
// Firebase Auth, purely because Firebase requires passwords of 6+
// characters. Coordinators still only ever type their 4-digit PIN.
// Change this to any string you like before you deploy (do it once,
// before creating any coordinators — changing it later breaks existing logins).
const PIN_SALT = "TRP26";
