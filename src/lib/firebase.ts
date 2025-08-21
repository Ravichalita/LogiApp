'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "caambacontrol3",
  "appId": "1:11233123437:web:edd2f4c4df82467edab364",
  "storageBucket": "caambacontrol3.firebasestorage.app",
  "apiKey": "AIzaSyABRxn8A7wsLOwhl0CaZGN9ZeQiUoiLdDs",
  "authDomain": "caambacontrol3.firebaseapp.com",
  "messagingSenderId": "11233123437"
};


// This function ensures that we initialize the app only once
// and that we can get the initialized app from anywhere in our code.
export function getFirebase() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}
