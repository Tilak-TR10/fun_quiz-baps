// js/config.js
// Safe, resilient configuration. Works automatically with or without Firebase credentials!
const firebaseConfig = {
    apiKey: "AIzaSyDj9A9l_qGPou-GG2o49Kz5m2uCKFtfy3g",
    authDomain: "fun-quiz-baps-9bc89.firebaseapp.com",
    projectId: "fun-quiz-baps-9bc89",
    storageBucket: "fun-quiz-baps-9bc89.firebasestorage.app",
    messagingSenderId: "746973971137",
    appId: "1:746973971137:web:7ce836d580cf561abc4a40",
    measurementId: "G-H29HPG9RB1"
};

let db = null;
let isFirebaseActive = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseActive = true;
    console.log("Firebase Realtime Database initialized.");
  } else {
    console.warn("Using local broadcast synchronization (BroadcastChannel / LocalStorage).");
  }
} catch (e) {
  console.warn("Firebase initialization skipped, fallback active:", e);
}
