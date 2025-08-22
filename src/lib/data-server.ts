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
    // This logic can be expanded. For now, it's a placeholder.
    // Example: Check a 'domains' collection or similar.
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

    try {
        return await firestore.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (userDoc.exists) {
                console.warn(`Documento de usuário para ${userRecord.uid} já existe.`);
                const accountId = userDoc.data()?.accountId;
                if (accountId) {
                    // Ensure claims are set even if doc exists but claims are missing
                    if (!userRecord.customClaims?.accountId || !userRecord.customClaims?.role) {
                         const role = userDoc.data()?.role || 'viewer';
                         await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });
                    }
                    return accountId;
                }
            }

            let accountId: string;
            let role: 'admin' | 'viewer';

            if (existingAccountId) {
                // Joining an existing account via invite
                accountId = existingAccountId;
                role = 'viewer';
            } else {
                // Creating a new account
                const accountRef = firestore.collection("accounts").doc();
                accountId = accountRef.id;
                role = 'admin'; 
                transaction.set(accountRef, {
                    ownerId: userRecord.uid,
                    name: `${userRecord.displayName || userRecord.email?.split('@')[0]}'s Account`,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [userRecord.uid],
                });
            }

            const userAccountData = {
                email: userRecord.email!,
                name: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuário',
                accountId: accountId,
                role: role,
                status: 'ativo',
                createdAt: FieldValue.serverTimestamp(),
            };

            transaction.set(userDocRef, userAccountData);
            
            // Set custom claims AFTER the transaction is successful
            await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });

            return accountId;
        });
    } catch (error) {
        console.error("Erro em ensureUserDocument, tentando limpar usuário Auth:", error);
        // If the transaction fails, the user created in Auth should be deleted.
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`CRÍTICO: Falha ao limpar usuário auth ${userRecord.uid} após falha na criação do documento. Por favor, delete manualmente.`, delErr)
        });
        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
