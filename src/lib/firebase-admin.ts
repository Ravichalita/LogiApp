
// src/lib/firebase-admin.ts
import 'server-only';
import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// IMPORTANT: When pasting the private key in .env.local, wrap it in quotes (`"`)
// to ensure the newlines are preserved.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
