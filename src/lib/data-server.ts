
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Permissions, PermissionsSchema, SignupSchema } from "./types";
import { z } from "zod";

const firestore = getFirestore();

/**
 * Ensures a user document exists in Firestore, creating it and an account if necessary.
 * Also ensures the user has the correct custom claims in Firebase Auth.
 * This is a critical function for security and multi-tenancy.
 *
 * @param userPayload The user data from the signup form.
 * @param inviterAccountId Optional ID of an existing account to join (for invites).
 * @returns The ID of the account the user is associated with.
 * @throws An error if the transaction fails or if the auth user can't be cleaned up on failure.
 */
export async function ensureUserDocument(
    userPayload: z.infer<typeof SignupSchema>, 
    inviterAccountId?: string | null
): Promise<string> {
    
    let newUserRecord: UserRecord | null = null;
    try {
        // Step 1: Create the user in Firebase Auth
        newUserRecord = await adminAuth.createUser({
            email: userPayload.email,
            password: userPayload.password,
            displayName: userPayload.name,
            emailVerified: true, // Auto-verify email for simplicity in this app
        });

        const uid = newUserRecord.uid;
        const userDocRef = firestore.doc(`users/${uid}`);

        // Step 2: Run a Firestore transaction to create database documents and set claims
        const accountId = await firestore.runTransaction(async (transaction) => {
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
                
                transaction.update(accountRef, {
                    members: FieldValue.arrayUnion(uid)
                });

            } else { // --- New Account/Admin Flow ---
                determinedAccountId = uid; // The first user's UID becomes the account ID
                role = 'admin';
                permissions = PermissionsSchema.parse({ // Admins get all permissions by default
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canEditClients: true,
                    canEditDumpsters: true,
                    canEditRentals: true,
                });
                
                const newAccountRef = firestore.doc(`accounts/${determinedAccountId}`);
                transaction.set(newAccountRef, {
                    ownerId: uid,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [uid],
                });
            }

            // Step 3: Set custom claims in Firebase Auth. This is critical for security rules.
            await adminAuth.setCustomUserClaims(uid, { accountId: determinedAccountId, role });

            // Step 4: Create the user document in Firestore.
            const userAccountData = {
                email: userPayload.email,
                name: userPayload.name,
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
        console.error("Erro na transação de ensureUserDocument. Revertendo...", error);
        
        // If any step failed, and we managed to create an auth user, we MUST delete them
        // to prevent an inconsistent state (e.g., auth user exists without a user document).
        if (newUserRecord) {
            try {
                await adminAuth.deleteUser(newUserRecord.uid);
                console.log(`Usuário Auth ${newUserRecord.uid} limpo com sucesso após falha na transação.`);
            } catch (deleteError) {
                 console.error(`CRÍTICO: Falha ao limpar o usuário Auth ${newUserRecord.uid} após falha na transação. Por favor, delete manualmente. Erro: ${deleteError}`);
            }
        }

        // Rethrow the original error to be handled by the caller (e.g., signupAction)
        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}

    