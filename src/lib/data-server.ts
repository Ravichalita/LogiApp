
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Permissions, PermissionsSchema } from "./types";

const firestore = getFirestore();

/**
 * Ensures a user document exists in Firestore, creating it and an account if necessary.
 * Also ensures the user has the correct custom claims in Firebase Auth.
 * This is a critical function for security and multi-tenancy.
 *
 * @param userRecord The user record from Firebase Admin Auth.
 * @param inviterAccountId Optional ID of an existing account to join (for invites).
 * @returns The ID of the account the user is associated with.
 * @throws An error if the transaction fails.
 */
export async function ensureUserDocument(userRecord: UserRecord, inviterAccountId?: string | null): Promise<string> {
    const userDocRef = firestore.doc(`users/${userRecord.uid}`);

    try {
        const accountId = await firestore.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);

            // 1. User document already exists, ensure claims and return.
            if (userDoc.exists) {
                const userData = userDoc.data();
                const existingAccountId = userData?.accountId;
                if (!existingAccountId) {
                    throw new Error(`Usuário ${userRecord.uid} existe mas não tem accountId.`);
                }
                
                // Safety net: If claims are missing from Auth, set them.
                if (!userRecord.customClaims?.accountId || userRecord.customClaims.accountId !== existingAccountId) {
                    const role = userData?.role || 'viewer';
                    await adminAuth.setCustomUserClaims(userRecord.uid, { accountId: existingAccountId, role });
                }
                return existingAccountId;
            }

            // 2. User document does NOT exist, create it along with account or membership.
            let determinedAccountId: string;
            let role: 'admin' | 'viewer';
            let permissions: Permissions;

            if (inviterAccountId) { // --- Invite Flow ---
                const accountRef = firestore.doc(`accounts/${inviterAccountId}`);
                const accountSnap = await transaction.get(accountRef);
                if (!accountSnap.exists) {
                    throw new Error(`A conta de convite ${inviterAccountId} não existe.`);
                }
                determinedAccountId = inviterAccountId;
                role = 'viewer';
                permissions = PermissionsSchema.parse({}); // Start with default (false) permissions
                
                // Add user to the account's members list
                transaction.update(accountRef, {
                    members: FieldValue.arrayUnion(userRecord.uid)
                });

            } else { // --- New Account/Admin Flow ---
                determinedAccountId = userRecord.uid; // The first user's UID becomes the account ID
                role = 'admin';
                permissions = PermissionsSchema.parse({
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canEditClients: true,
                    canEditDumpsters: true,
                    canEditRentals: true,
                });
                
                // Create the new account document
                const newAccountRef = firestore.doc(`accounts/${determinedAccountId}`);
                transaction.set(newAccountRef, {
                    ownerId: userRecord.uid,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [userRecord.uid],
                });
            }

            // CRITICAL: Set custom claims in Firebase Auth FIRST, before committing DB changes.
            // If this step fails, the transaction will be rolled back, and no DB changes will be made.
            await adminAuth.setCustomUserClaims(userRecord.uid, { accountId: determinedAccountId, role });

            // Now define and create the user document in Firestore within the same transaction.
            const userAccountData = {
                email: userRecord.email!,
                name: userRecord.displayName || userRecord.email!.split('@')[0],
                accountId: determinedAccountId,
                role: role,
                status: 'ativo',
                permissions: permissions,
                createdAt: FieldValue.serverTimestamp(),
            };
            transaction.set(userDocRef, userAccountData);

            return determinedAccountId;
        });
        
        return accountId;

    } catch (error) {
        console.error("Erro na transação de ensureUserDocument. Tentando limpar usuário Auth se necessário:", error);
        
        // If the transaction failed, the user might have been created in Auth but not in Firestore.
        // We must delete the Auth user to prevent an inconsistent state.
        try {
            await adminAuth.deleteUser(userRecord.uid);
            console.log(`Usuário Auth ${userRecord.uid} limpo com sucesso após falha na transação.`);
        } catch (deleteError) {
             console.error(`CRÍTICO: Falha ao limpar o usuário Auth ${userRecord.uid} após falha na transação. Por favor, delete manualmente. Erro: ${deleteError}`);
        }

        // Rethrow the original error to be handled by the caller (e.g., signupAction)
        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
