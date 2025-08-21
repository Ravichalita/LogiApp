'use server';
import * as admin from 'firebase-admin';

// This function initializes Firebase Admin SDK and is meant to be used in server-side code (Server Actions, API Routes).
export async function getFirebaseAdmin() {
    if (admin.apps.length > 0) {
        return { 
            app: admin.app(), 
            db: admin.firestore(), 
            auth: admin.auth() 
        };
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. This is required for server-side Firebase Admin operations.');
    }

    const app = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    
    const db = admin.firestore(app);
    const auth = admin.auth(app);

    return { app, db, auth };
}
