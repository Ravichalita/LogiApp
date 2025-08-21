
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
    // This is a placeholder for a more robust domain-to-account mapping.
    // In a real app, you might query a dedicated 'domains' collection.
    return null;
}

/**
 * Ensures a user document exists in Firestore and, critically, sets their custom claims.
 * It creates the associated account and user documents in a transaction.
 * If an accountId is provided, it links the user to that existing account.
 * CRITICALLY, it sets custom claims on the user's auth token, which is the
 * recommended and most secure way to handle authorization in Firestore rules.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @param existingAccountId Optional ID of an existing account to join.
 * @returns The ID of the account the user is associated with.
 * @throws An error if the document creation fails.
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
                // Ensure claims are set even if doc exists but claims are missing
                if (!userRecord.customClaims?.accountId) {
                     await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role: userData.role || 'viewer' });
                }
                return accountId;
            }
            // Fallthrough to create if accountId is missing
        }

        let accountId: string;
        let role: 'admin' | 'viewer';

        if (existingAccountId) {
            accountId = existingAccountId;
            role = 'viewer'; // Invited users are viewers by default
        } else {
            // Create a new account for the first user
            const accountRef = firestore.collection("accounts").doc();
            transaction.set(accountRef, {
                ownerId: userRecord.uid,
                name: `${userRecord.displayName || userRecord.email?.split('@')[0]}'s Account`,
                createdAt: FieldValue.serverTimestamp(),
            });
            accountId = accountRef.id;
            role = 'admin'; // The creator of an account is the admin.
        }

        const userAccountData = {
            email: userRecord.email,
            name: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuário sem nome',
            accountId: accountId,
            role: role,
            status: 'ativo',
        };

        transaction.set(userDocRef, userAccountData);
        
        // This is a critical step: Set custom claims on the user's auth token.
        // These claims are used in Firestore security rules for secure and efficient access control.
        await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });

        return accountId;
    }).catch(async (error) => {
        console.error("Error in ensureUserDocument transaction, attempting to clean up Auth user:", error);
        // If the transaction fails, we should delete the auth user to prevent an orphaned account.
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`CRITICAL: Failed to cleanup auth user ${userRecord.uid} after doc creation failure. Please delete manually.`, delErr)
        });
        throw error;
    });
}
