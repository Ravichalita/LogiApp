
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { PermissionsSchema } from "./types";

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
 * Ensures a user document exists in Firestore, creating it and an account if necessary.
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
            if (userDoc.exists) {
                const accountId = userDoc.data()?.accountId;
                if (!accountId) {
                    throw new Error(`Usuário ${userRecord.uid} existe mas não tem accountId.`);
                }
                 if (!userRecord.customClaims?.accountId || !userRecord.customClaims?.role) {
                     const role = userDoc.data()?.role || 'viewer';
                     await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });
                }
                return accountId;
            }

            let accountId: string;
            let role: 'admin' | 'viewer';
            let permissions: ReturnType<typeof PermissionsSchema.parse>;
            const accountRef = inviterAccountId ? firestore.doc(`accounts/${inviterAccountId}`) : null;

            if (accountRef) { // This is an invite flow
                const accountSnap = await transaction.get(accountRef);
                if (!accountSnap.exists) {
                    throw new Error(`A conta de convite ${inviterAccountId} não existe.`);
                }
                accountId = inviterAccountId!;
                role = 'viewer'; 
                permissions = PermissionsSchema.parse({}); // All false by default for viewer
            } else { // This is a first-time signup for a new account
                accountId = userRecord.uid; // The first user's UID becomes the account ID
                role = 'admin';
                permissions = PermissionsSchema.parse({
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canEditClients: true,
                    canEditDumpsters: true,
                    canEditRentals: true,
                    canDeleteItems: true,
                });
                const newAccountRef = firestore.doc(`accounts/${accountId}`);
                transaction.set(newAccountRef, {
                    ownerId: userRecord.uid,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [userRecord.uid], // Add self to members list
                });
            }

            const userAccountData = {
                email: userRecord.email!,
                name: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuário',
                accountId: accountId,
                role: role,
                status: 'ativo',
                permissions: permissions,
                createdAt: FieldValue.serverTimestamp(),
            };

            transaction.set(userDocRef, userAccountData);
            
            await adminAuth.setCustomUserClaims(userRecord.uid, { accountId, role });
            
            if (accountRef) { // If it was an invite, add user to members list
                 transaction.update(accountRef, {
                    members: FieldValue.arrayUnion(userRecord.uid)
                });
            }

            return accountId;
        });
    } catch (error) {
        console.error("Erro em ensureUserDocument, tentando limpar usuário Auth:", error);
        await adminAuth.deleteUser(userRecord.uid).catch(delErr => {
            console.error(`CRÍTICO: Falha ao limpar usuário auth ${userRecord.uid} após falha na criação do documento. Por favor, delete manualmente.`, delErr)
        });
        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
