import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"; // Not supported directly in RN JS SDK without WebView/Native
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth'; // Persistence is handled automatically if async-storage is present
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// import { getMessaging, getToken, onMessage, Unsubscribe } from 'firebase/messaging'; // Requires generic service worker or react-native-firebase
// import { toast } from '@/hooks/use-toast'; 

const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForVerificationOnly",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-project.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-project.appspot.com",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function getFirebase() {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    // Auth handles persistence automatically if @react-native-async-storage/async-storage is installed
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    // Analytics often requires native module or special handling in RN, keeping it simple for now
    // const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

    return { app, auth, db, storage };
}

export async function getFirebaseIdToken() {
    const { auth } = getFirebase();
    if (!auth?.currentUser) {
        return null;
    }
    return await auth.currentUser.getIdToken(true);
}
