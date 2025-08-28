
'use server';

import type { UserRecord } from "firebase-admin/auth";
import { adminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Permissions, PermissionsSchema, SignupSchema, UserRole } from "./types";
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
): Promise<{ accountId: string; userId: string }> {
    
    // Check if user already exists before creating a new auth record
    const existingUser = await adminAuth.getUserByEmail(userPayload.email).catch(() => null);
    if (existingUser) {
        throw new Error("Este e-mail já está cadastrado.");
    }
    
    let newUserRecord: UserRecord | null = null;
    try {
        const isInviteFlow = !!inviterAccountId;

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
            let role: UserRole;
            let permissions: Permissions;

            if (isInviteFlow) { // --- Invite Member Flow ---
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

            } else { // --- New Client/Admin Account Flow ---
                determinedAccountId = uid; // The first user's UID becomes the account ID
                role = 'owner'; // The creator of the account is the owner
                permissions = PermissionsSchema.parse({ // Owners get all permissions by default
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canEditClients: true,
                    canEditDumpsters: true,
                    canEditRentals: true,
                    canAccessSettings: true,
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
                hasSeenWelcome: false, // Initialize the flag for the welcome dialog
            };
            transaction.set(userDocRef, userAccountData);

            return determinedAccountId;
        });

        return { accountId, userId: uid };

    } catch (error) {
        console.error("Erro na transação de ensureUserDocument. Revertendo...", error);
        
        if (newUserRecord) {
            try {
                await adminAuth.deleteUser(newUserRecord.uid);
                console.log(`Usuário Auth ${newUserRecord.uid} limpo com sucesso após falha na transação.`);
            } catch (deleteError) {
                 console.error(`CRÍTICO: Falha ao limpar o usuário Auth ${newUserRecord.uid} após falha na transação. Por favor, delete manualmente. Erro: ${deleteError}`);
            }
        }

        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
