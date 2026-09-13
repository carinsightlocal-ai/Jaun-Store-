// Firebase Configuration & Service Initialization for Jaun Store
// Project: jaun-d2612

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  increment, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
  getAnalytics, 
  isSupported as isAnalyticsSupported, 
  logEvent 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkT5-zxfXvQAFxZufKC852wPQfzdpdnnM",
  authDomain: "jaun-d2612.firebaseapp.com",
  projectId: "jaun-d2612",
  storageBucket: "jaun-d2612.firebasestorage.app",
  messagingSenderId: "447303783720",
  appId: "1:447303783720:web:42b0ed1cd5ad35a928ac1d"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const db = getFirestore(app);

// Initialize Firebase Auth
const auth = getAuth(app);

// Optional Analytics (only runs if supported in the browser)
let analytics = null;
isAnalyticsSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log("⚡ Firebase Analytics initialized for Jaun Store");
  }
}).catch(() => {
  // Analytics not supported in this environment (e.g. file:// or ad blocker)
});

console.log("🔥 Firebase initialized successfully: jaun-d2612");

export {
  app,
  db,
  auth,
  analytics,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  logEvent
};
