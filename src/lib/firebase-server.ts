
'use server';
import * as admin from 'firebase-admin';

// This function initializes Firebase Admin SDK and is meant to be used in server-side code (Server Actions, API Routes).
export async function getFirebaseAdmin() {
    if (admin.apps.length > 0) {
        const app = admin.app();
        const db = admin.firestore(app);
        const auth = admin.auth(app);
        return { app, db, auth };
    }

    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEnv) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. This is required for server-side Firebase Admin operations.');
    }

    try {
        const serviceAccount = typeof serviceAccountEnv === 'string'
            ? JSON.parse(serviceAccountEnv)
            : serviceAccountEnv;

        // The credential object might be wrapped in a `credential` property.
        const credential = serviceAccount.credential 
            ? admin.credential.cert(serviceAccount.credential) 
            : admin.credential.cert(serviceAccount);
            
        const app = admin.initializeApp({
             credential,
        });

        const db = admin.firestore(app);
        const auth = admin.auth(app);

        return { app, db, auth };
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e);
        if (e instanceof Error) {
             throw new Error(`Could not initialize Firebase Admin: ${e.message}`);
        }
        throw new Error("An unknown error occurred during Firebase Admin initialization.");
    }
}
