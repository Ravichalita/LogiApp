
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const firestore = getFirestore();

/**
 * Finds an existing account ID based on the user's email domain.
 * This allows new users from the same company to join the same account.
 * @param domain The email domain of the user signing up.
 * @returns The accountId if found, otherwise null.
 */
export async function findAccountByEmailDomain(domain: string): Promise<string | null> {
    if (!domain) return null;
    // In a real app, you might query a dedicated 'domains' collection
    // to map company domains to account IDs.
    // For this app, we'll keep it simple and not auto-join accounts by domain.
    return null;
}

/**
 * Ensures a user document exists in Firestore and sets their custom claims.
 * This is a critical function for security and multi-tenancy.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @param existingAccountId Optional ID of an existing account to join (for invites).
 * @returns The ID of the account the user is associated with.
 * @throws An error if the transaction fails, and attempts to clean up the auth user.
 */
export async function ensureUserDocument(userRecord: UserRecord, existingAccountId?: string | null): Promise<string> {
    const userDocRef = firestore.doc(`users/${userRecord.uid}`);

    return firestore.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userDocRef);
        if (docSnap.exists) {
            console.warn(`User document for ${userRecord.uid} already exists.`);
            const userData = docSnap.data();
            const accountId = userData?.accountId;
            if (accountId) {
                 await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role: userData.role || 'viewer' });
                return accountId;
            }
        }

        let accountId: string;
        let role: 'admin' | 'viewer';

        if (existingAccountId) {
            accountId = existingAccountId;
            role = 'viewer'; 
        } else {
            const accountRef = firestore.collection("accounts").doc();
            transaction.set(accountRef, {
                ownerId: userRecord.uid,
                name: `${userRecord.displayName || userRecord.email?.split('@')[0]}'s Account`,
                createdAt: FieldValue.serverTimestamp(),
            });
            accountId = accountRef.id;
            role = 'admin';
        }

        const userAccountData = {
            email: userRecord.email,
            name: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuário',
            accountId: accountId,
            role: role,
            status: 'ativo',
        };

        transaction.set(userDocRef, userAccountData);
        
        await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });

        return accountId;
    }).catch(async (error) => {
        console.error("Error in ensureUserDocument transaction, attempting to clean up Auth user:", error);
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`CRITICAL: Failed to cleanup auth user ${userRecord.uid} after doc creation failure. Please delete manually.`, delErr)
        });
        throw error;
    });
}
