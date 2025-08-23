
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
        return await firestore.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);

            // 1. User document already exists
            if (userDoc.exists) {
                const userData = userDoc.data();
                const accountId = userData?.accountId;
                if (!accountId) {
                    throw new Error(`Usuário ${userRecord.uid} existe mas não tem accountId.`);
                }
                
                // Safety net: If claims are missing from Auth, set them.
                if (!userRecord.customClaims?.accountId || userRecord.customClaims.accountId !== accountId) {
                    const role = userData?.role || 'viewer';
                    await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });
                }
                return accountId;
            }

            // 2. User document does NOT exist, create it
            let accountId: string;
            let role: 'admin' | 'viewer';
            let permissions: Permissions;

            if (inviterAccountId) { // --- Invite Flow ---
                const accountRef = firestore.doc(`accounts/${inviterAccountId}`);
                const accountSnap = await transaction.get(accountRef);
                if (!accountSnap.exists) {
                    throw new Error(`A conta de convite ${inviterAccountId} não existe.`);
                }
                accountId = inviterAccountId;
                role = 'viewer';
                permissions = PermissionsSchema.parse({}); // Start with default (false) permissions
                
                // Add user to the account's members list
                transaction.update(accountRef, {
                    members: FieldValue.arrayUnion(userRecord.uid)
                });

            } else { // --- New Account/Admin Flow ---
                accountId = userRecord.uid; // The first user's UID becomes the account ID
                role = 'admin';
                permissions = PermissionsSchema.parse({
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canEditClients: true,
                    canEditDumpsters: true,
                    canEditRentals: true,
                });
                
                // Create the new account document
                const newAccountRef = firestore.doc(`accounts/${accountId}`);
                transaction.set(newAccountRef, {
                    ownerId: userRecord.uid,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [userRecord.uid],
                });
            }

            // Define the user document data
            const userAccountData = {
                email: userRecord.email!,
                name: userRecord.displayName || userRecord.email!.split('@')[0],
                accountId: accountId,
                role: role,
                status: 'ativo',
                permissions: permissions,
                createdAt: FieldValue.serverTimestamp(),
            };
            
            // CRITICAL: Set custom claims in Firebase Auth for security rules
            await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });

            // Create the user document in Firestore
            transaction.set(userDocRef, userAccountData);

            return accountId;
        });
    } catch (error) {
        console.error("Erro em ensureUserDocument, tentando limpar usuário Auth se necessário:", error);
        // If the user document creation failed, it's safer to delete the auth user
        // to prevent a state where a user exists in Auth but not in Firestore DB.
        const userExistsInAuth = await adminAuth.getUser(userRecord.uid).catch(() => null);
        if (userExistsInAuth) {
             const userDocExists = (await userDocRef.get()).exists;
             if (!userDocExists) {
                await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
                    console.error(`CRÍTICO: Falha ao limpar usuário auth ${userRecord.uid} após falha na criação do documento. Por favor, delete manualmente.`, delErr)
                });
             }
        }
        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
