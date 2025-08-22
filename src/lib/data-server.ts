'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const firestore = getFirestore();

/**
 * Finds an existing account ID based on the user's email domain.
 * This logic is currently disabled in favor of an invite-only system.
 * @param domain The email domain of the user signing up.
 * @returns Null, as this lookup is disabled.
 */
export async function findAccountByEmailDomain(domain: string): Promise<string | null> {
    // This logic is disabled. New users must be invited.
    return null;
}

/**
 * Ensures a user document exists in Firestore and sets their custom claims.
 * This is a critical function for security and multi-tenancy.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @param existingAccountId The required ID of an existing account to join (for invites).
 * @returns The ID of the account the user is associated with.
 * @throws An error if the transaction fails, or if no accountId is provided.
 */
export async function ensureUserDocument(userRecord: UserRecord, existingAccountId?: string | null): Promise<string> {
    const userDocRef = firestore.doc(`users/${userRecord.uid}`);

    // This is the core business logic change: a user can only be created if they are being added to an existing account.
    if (!existingAccountId) {
        // Clean up the created auth user if they don't have an account to join.
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
             console.error(`CRÍTICO: Falha ao limpar usuário auth ${userRecord.uid} que não tinha uma conta para entrar.`, delErr)
        });
        throw new Error("Novos usuários devem ser convidados para uma conta existente.");
    }

    try {
        return await firestore.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (userDoc.exists) {
                console.warn(`Documento de usuário para ${userRecord.uid} já existe.`);
                const accountId = userDoc.data()?.accountId;
                if (accountId) {
                     if (!userRecord.customClaims?.accountId || !userRecord.customClaims?.role) {
                         const role = userDoc.data()?.role || 'viewer';
                         await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });
                    }
                    return accountId;
                }
            }

            const accountId = existingAccountId;
            const role = 'viewer'; // New users invited to an account are always 'viewer' by default.

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

            // Also add the new user's ID to the account's member list
            const accountRef = firestore.doc(`accounts/${accountId}`);
            transaction.update(accountRef, {
                members: FieldValue.arrayUnion(userRecord.uid)
            });

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
