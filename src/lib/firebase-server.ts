
import * as admin from 'firebase-admin';

// This file is server-only. It initializes the Firebase Admin SDK.

// Because this code is running in a Google-managed environment (App Hosting),
// the SDK can automatically detect the service account credentials and initialize.
// We don't need to manage service account keys manually.

if (!admin.apps.length) {
  admin.initializeApp();
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
