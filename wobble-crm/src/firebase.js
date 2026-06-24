import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCxuXIdHcjxMflUxN5JR9VKCZdU5cUQEFo",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "wobble-one-crm-a.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "wobble-one-crm-a",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "wobble-one-crm-a.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "543691399169",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:543691399169:web:83463a71d7b39972822000",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-G7TYLZTN4C",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);