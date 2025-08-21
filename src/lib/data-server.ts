
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
    const usersRef = firestore.collection('users');
    // As Firestore doesn't support ending-with queries, we fetch users with the same domain.
    // This is not perfectly scalable but works for many scenarios.
    // A more robust solution might involve a separate collection of domains.
    const q = usersRef.where('email', '>=', `a@${domain}`).where('email', '<=', `z@${domain}`).limit(1);

    try {
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const user = snapshot.docs[0].data();
            // Ensure the found email actually belongs to the same domain.
            if (user.email && typeof user.email === 'string' && user.email.endsWith(`@${domain}`)) {
                return user.accountId;
            }
        }
    } catch (error) {
        console.error("Error finding account by email domain:", error);
    }
    
    return null;
}


/**
 * Ensures a user document exists in Firestore after user creation.
 * It creates the associated account and user documents in a transaction.
 * If an accountId is provided, it links the user to that existing account.
 * It also sets custom claims on the user's auth token, which is crucial for security rules.
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
            const accountId = docSnap.data()?.accountId;
            // Ensure claims are set even if doc exists but claims are missing
            if (request.auth?.token.accountId !== accountId) {
                 await adminAuth.setCustomUserClaims(userRecord.uid, { 
                    accountId: accountId, 
                    role: docSnap.data()?.role || 'viewer' 
                });
            }
            return accountId;
        }

        let accountId: string;
        let role: 'admin' | 'viewer' = 'viewer';

        if (existingAccountId) {
            // User is invited to an existing account.
            accountId = existingAccountId;
            role = 'viewer'; // Invited users are viewers by default
        } else {
            // First user, or user from a new domain, becomes the admin of a new account.
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
            status: 'ativo', // Default status is active
        };

        transaction.set(userDocRef, userAccountData);
        
        // This is a critical step: Set custom claims on the user's auth token.
        // These claims are used in Firestore security rules for secure and efficient access control.
        await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });

        return accountId;
    }).catch(async (error) => {
        console.error("Error in ensureUserDocument transaction, attempting to clean up Auth user:", error);
        // If the database transaction fails, we should not leave an orphaned auth user.
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`CRITICAL: Failed to cleanup auth user ${userRecord.uid} after doc creation failure. Please delete manually.`, delErr)
        });
        // Re-throw the original error to be handled by the caller action.
        throw error;
    });
}
