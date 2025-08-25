
// src/lib/firebase-admin.ts
import 'server-only';
import { getApps, getApp, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Firebase Admin SDK non foi configurado. Verifique as variáveis de ambiente.');
}

const firebaseAdminConfig = {
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket: `${projectId}.appspot.com`,
};

let adminApp: App;
if (!getApps().length) {
  adminApp = initializeApp(firebaseAdminConfig);
} else {
  adminApp = getApp();
}

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
// Exportamos o app inteiro para garantir que a configuração seja usada corretamente
export { adminApp };
