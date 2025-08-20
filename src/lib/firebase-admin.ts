import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Ensure you have the service account key in an environment variable
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  throw new Error('A variável de ambiente FIREBASE_SERVICE_ACCOUNT_KEY não está definida. O SDK Admin não pode ser inicializado.');
}

const parsedServiceAccount = JSON.parse(serviceAccountKey);

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(parsedServiceAccount),
    });

export const adminDb = getFirestore(app);
