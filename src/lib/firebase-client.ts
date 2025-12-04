
// src/lib/firebase-client.ts
'use client';
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage, Unsubscribe } from 'firebase/messaging';
import { toast } from '@/hooks/use-toast';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForVerificationOnly",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};


// This function ensures that we initialize the app only once
// and that we can get the initialized app from anywhere in our code.
export function getFirebase() {
  // Prevent initialization on the server
  if (typeof window === 'undefined') {
    // This is a dummy return for the server. The actual initialization
    // will happen in a useEffect on the client.
    return { app: null, auth: null, db: null, analytics: null, storage: null };
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

  // Initialize App Check
  if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
      initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
      });
  } else {
      console.warn("Firebase App Check is not initialized. Missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY.");
  }


  return { app, auth, db, analytics, storage };
}

// Add this function to be callable from the AuthProvider
export async function getFirebaseIdToken() {
    const { auth } = getFirebase();
    if (!auth?.currentUser) {
        return null;
    }
    return await auth.currentUser.getIdToken(true); // Force refresh
}

let onMessageUnsubscribe: Unsubscribe | null = null;

// Function to initialize FCM and get token
export const setupFcm = async (userId: string) => {
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
        console.log("FCM setup skipped: Not in browser or VAPID key is missing.");
        return () => {}; // Return a no-op unsubscribe function
    }

    try {
        const { app, db } = getFirebase();
        if (!app || !db) return () => {};
        const messaging = getMessaging(app);

        // Register the service worker
        const swRegistration = await navigator.serviceWorker.register(
            `/firebase-messaging-sw.js`
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

        // Unsubscribe from any previous onMessage listener
        if (onMessageUnsubscribe) {
            onMessageUnsubscribe();
            onMessageUnsubscribe = null;
        }

        // Handle foreground messages.
        // The service worker will handle displaying the notification.
        onMessageUnsubscribe = onMessage(messaging, (payload) => {
            console.log('Foreground message received. ', payload);
            // The service worker (`push` event) is responsible for showing the notification.
            // So we don't need to do anything here to avoid duplicate notifications.
        });

        // Return the unsubscribe function to be called on cleanup
        return () => {
            if (onMessageUnsubscribe) {
                onMessageUnsubscribe();
                onMessageUnsubscribe = null;
            }
        };

    } catch (error) {
        console.error('An error occurred while setting up FCM.', error);
        return () => {};
    }
};

export const cleanupFcm = () => {
    if (onMessageUnsubscribe) {
        onMessageUnsubscribe();
        onMessageUnsubscribe = null;
        console.log('FCM onMessage listener cleaned up.');
    }
};
