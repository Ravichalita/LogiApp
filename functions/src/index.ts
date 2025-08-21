/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {auth} from "firebase-functions/v1";

initializeApp();

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = onCall((request) => {
//   logger.info("Hello logs!", {structuredData: true});
//   return "Hello from Firebase!";
// });

exports.createAccountAndUserDoc = auth.user().onCreate(async (user) => {
  logger.info(`New user created: ${user.uid}, email: ${user.email}`);

  if (!user.email) {
    logger.error(`User ${user.uid} has no email, cannot create documents.`);
    return;
  }

  const adminDb = getFirestore();
  const batch = adminDb.batch();

  try {
    // 1. Create a new account document
    const accountRef = adminDb.collection("accounts").doc();
    batch.set(accountRef, {
      ownerId: user.uid,
      name: `${user.email}'s Account`,
      createdAt: new Date(),
    });
    logger.info(`Account document prepared for user: ${user.uid}`);

    // 2. Create the user document and link it to the new account
    const userRef = adminDb.collection("users").doc(user.uid);
    batch.set(userRef, {
      email: user.email,
      accountId: accountRef.id,
      role: "admin",
    });
    logger.info(`User document prepared for user: ${user.uid}`);

    // 3. Commit the batch
    await batch.commit();
    logger.info(`Successfully created account and user docs for ${user.uid}`);
  } catch (error) {
    logger.error(
      `Error creating user account in Firestore for UID: ${user.uid}`,
      error,
    );
    // We don't re-throw here to prevent the function from retrying
    // on what might be a permanent failure (e.g., permissions).
  }
});
