import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// When running in a Google Cloud environment, the SDK is automatically initialized.
// No need to pass in service account credentials.
const app = getApps().length
  ? getApps()[0]
  : initializeApp();

export const adminDb = getFirestore(app);
