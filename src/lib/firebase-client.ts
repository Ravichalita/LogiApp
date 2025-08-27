
// src/lib/firebase-client.ts
'use client';
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { toast } from '@/hooks/use-toast';

const firebaseConfig: FirebaseOptions = {
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

// Function to initialize FCM and get token
export const setupFcm = async (userId: string) => {
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
        console.log("FCM setup skipped: Not in browser or VAPID key is missing.");
        return;
    }

    try {
        const { app, db } = getFirebase();
        const messaging = getMessaging(app);

        // Register the service worker
        const swRegistration = await navigator.serviceWorker.register(
            `/firebase-messaging-sw.js?firebaseConfig=${encodeURIComponent(JSON.stringify(firebaseConfig))}`
        );

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            // Get token
            const fcmToken = await getToken(messaging, { 
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: swRegistration
             });

            if (fcmToken) {
                console.log('FCM Token:', fcmToken);
                // Save the token to the user's document in Firestore
                const userDocRef = doc(db, 'users', userId);
                await updateDoc(userDocRef, {
                    fcmTokens: arrayUnion(fcmToken)
                });
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
        }

        // Handle foreground messages
        onMessage(messaging, (payload) => {
            console.log('Foreground message received. ', payload);
            // Show a custom toast notification here instead of a system notification
            toast({
                title: payload.data?.title,
                description: payload.data?.body,
            });
        });
    } catch (error) {
        console.error('An error occurred while setting up FCM.', error);
    }
};
