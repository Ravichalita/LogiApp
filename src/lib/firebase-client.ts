
// src/lib/firebase-client.ts
'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


// This function ensures that we initialize the app only once
// and that we can get the initialized app from anywhere in our code.
export function getFirebase() {
  // Prevent initialization on the server
  if (typeof window === 'undefined') {
    // This is a dummy return for the server. The actual initialization
    // will happen in a useEffect on the client.
    return { app: null, auth: null, db: null };
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

// Add this function to be callable from the AuthProvider
export async function getFirebaseIdToken() {
    const { auth } = getFirebase();
    if (!auth.currentUser) {
        return null;
    }
    return await auth.currentUser.getIdToken(true); // Force refresh
}
