
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminDb, adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const firestore = getFirestore();

/**
 * Ensures a user document exists in Firestore after user creation.
 * It creates the associated account and user documents in a transaction.
 * Includes a retry mechanism to handle potential replication delays.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @returns The ID of the newly created account.
 * @throws An error if the document creation fails after multiple retries.
 */
export async function ensureUserDocument(userRecord: UserRecord): Promise<string> {
    const userDocRef = firestore.doc(`users/${userRecord.uid}`);

    try {
        // First, check if the document already exists (e.g., from a previous, interrupted run)
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
            return docSnap.data()?.accountId;
        }

        // If it doesn't exist, create it in a batch write for atomicity
        const batch = firestore.batch();

        const accountRef = firestore.collection("accounts").doc();
        batch.set(accountRef, {
            ownerId: userRecord.uid,
            name: `${userRecord.email}'s Account`,
            createdAt: FieldValue.serverTimestamp(),
        });

        batch.set(userDocRef, {
            email: userRecord.email,
            accountId: accountRef.id,
            role: "admin",
        });

        await batch.commit();

        // After committing, verify the document exists with retries
        for (let i = 0; i < 5; i++) {
            const finalSnap = await userDocRef.get();
            if (finalSnap.exists) {
                console.log(`User document for ${userRecord.uid} confirmed after ${i + 1} attempts.`);
                return accountRef.id;
            }
            console.log(`Retrying user document check for ${userRecord.uid}, attempt ${i + 2}...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        }

        throw new Error(`Failed to verify user document creation for UID: ${userRecord.uid}`);
    } catch (error) {
        console.error("Error in ensureUserDocument:", error);
        // If there's an error, it's safer to delete the auth user
        // to allow them to try signing up again.
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`Failed to cleanup auth user ${userRecord.uid} after doc creation failure:`, delErr)
        });
        throw error; // Re-throw the original error to be caught by the action
    }
}

    