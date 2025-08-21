
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminDb, adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const firestore = getFirestore();

/**
 * Finds an existing account ID based on the user's email domain.
 * This allows new users from the same company to join the same account.
 * @param domain The email domain of the user signing up.
 * @returns The accountId if found, otherwise null.
 */
export async function findAccountByEmailDomain(domain: string): Promise<string | null> {
    const usersRef = firestore.collection('users');
    const q = usersRef.where('email', '>=', `@${domain}`).where('email', '<=', `@${domain}\uf8ff`).limit(1);
    const snapshot = await q.get();

    if (!snapshot.empty) {
        const existingUser = snapshot.docs[0].data();
        return existingUser.accountId;
    }
    return null;
}


/**
 * Ensures a user document exists in Firestore after user creation.
 * It creates the associated account and user documents in a transaction.
 * If an accountId is provided, it links the user to that existing account.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @param existingAccountId Optional ID of an existing account to join.
 * @returns The ID of the account the user is associated with.
 * @throws An error if the document creation fails after multiple retries.
 */
export async function ensureUserDocument(userRecord: UserRecord, existingAccountId?: string | null): Promise<string> {
    const userDocRef = firestore.doc(`users/${userRecord.uid}`);

    try {
        const docSnap = await userDocRef.get();
        if (docSnap.exists) {
            return docSnap.data()?.accountId;
        }

        const batch = firestore.batch();
        let accountId: string;
        let role: 'admin' | 'viewer' = 'viewer';

        if (existingAccountId) {
            accountId = existingAccountId;
        } else {
            // First user from a domain becomes the admin of a new account
            const accountRef = firestore.collection("accounts").doc();
            batch.set(accountRef, {
                ownerId: userRecord.uid,
                name: `${userRecord.displayName}'s Account`,
                createdAt: FieldValue.serverTimestamp(),
            });
            accountId = accountRef.id;
            role = 'admin';
        }

        batch.set(userDocRef, {
            email: userRecord.email,
            name: userRecord.displayName || userRecord.email?.split('@')[0],
            accountId: accountId,
            role: role,
            status: 'ativo', // Default status
        });

        await batch.commit();

        return accountId;
    } catch (error) {
        console.error("Error in ensureUserDocument:", error);
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`Failed to cleanup auth user ${userRecord.uid} after doc creation failure:`, delErr)
        });
        throw error;
    }
}
