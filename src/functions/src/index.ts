
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK if it hasn't been already.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * A Cloud Function that triggers when a new user is created in Firebase Authentication.
 * It creates a corresponding 'account' and 'user' document in Firestore.
 */
export const createAccountAndUserDoc = functions.auth.user().onCreate(async (user) => {
  logger.info(`New user signup: ${user.uid}, email: ${user.email}`);

  if (!user.email) {
    logger.error(`User ${user.uid} has no email, cannot create documents.`);
    return; // Exit if the user has no email.
  }

  const adminDb = admin.firestore();
  const batch = adminDb.batch();

  try {
    // 1. Create a new account document in the 'accounts' collection.
    const accountRef = adminDb.collection("accounts").doc(); // Auto-generate ID
    batch.set(accountRef, {
      ownerId: user.uid,
      name: `${user.email}'s Account`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
    });
    logger.info(`Account document prepared for user: ${user.uid} with accountId: ${accountRef.id}`);

    // 2. Create the user document in the 'users' collection.
    // The user document ID will be the same as the Firebase Auth UID.
    const userRef = adminDb.collection("users").doc(user.uid);
    batch.set(userRef, {
      email: user.email,
      accountId: accountRef.id, // Link the user to the newly created account
      role: "admin",
    });
    logger.info(`User document prepared for user: ${user.uid}`);

    // 3. Atomically commit the batch to write both documents.
    await batch.commit();
    logger.info(`Successfully created account and user documents for ${user.uid}`);

  } catch (error) {
    logger.error(
      `Error creating user documents in Firestore for UID: ${user.uid}`,
      error
    );
    // We don't re-throw the error to prevent the function from retrying,
    // as it might be a permanent failure (e.g., permissions issue that needs fixing).
  }
});
