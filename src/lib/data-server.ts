

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
 * @param userPayload The user data. For new users, it includes a password. For existing auth users (recovery), it does not.
 * @param inviterAccountId Optional ID of an existing account to join (for invites).
 * @returns The ID of the account the user is associated with.
 * @throws An error if the transaction fails or if the auth user can't be cleaned up on failure.
 */
export async function ensureUserDocument(
    userPayload: Omit<z.infer<typeof SignupSchema>, 'confirmPassword'>, 
    inviterAccountId?: string | null
): Promise<{ accountId: string; userId: string }> {
    
    let userRecord: UserRecord | null = null;
    let isNewUser = false;

    // Check if user already exists
    userRecord = await adminAuth.getUserByEmail(userPayload.email).catch(() => null);

    if (!userRecord) {
        // User does not exist, create them in Auth
        if (!userPayload.password) {
            throw new Error("A senha é necessária para criar um novo usuário.");
        }
        userRecord = await adminAuth.createUser({
            email: userPayload.email,
            password: userPayload.password,
            displayName: userPayload.name,
            emailVerified: true, // Auto-verify email for simplicity in this app
        });
        isNewUser = true;
    }
    
    // At this point, we have a valid userRecord, either existing or newly created.
    const uid = userRecord.uid;
    const userDocRef = firestore.doc(`users/${uid}`);

    // If the user document already exists, we assume the setup is complete and do nothing.
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
        const existingData = userDocSnap.data();
        if (existingData && existingData.accountId) {
             console.log(`User document for ${userPayload.email} already exists. Skipping creation.`);
             // Ensure claims are set, as they might be missing in a recovery scenario
             if (!userRecord.customClaims?.accountId || userRecord.customClaims.accountId !== existingData.accountId) {
                 await adminAuth.setCustomUserClaims(uid, { accountId: existingData.accountId, role: existingData.role });
             }
             return { accountId: existingData.accountId, userId: uid };
        }
    }
    
    try {
        const isInviteFlow = !!inviterAccountId;

        // Run a Firestore transaction to create database documents and set claims
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
                    canAccessRentals: true,
                    canAccessOperations: true,
                    canAccessClients: true,
                    canAccessDumpsters: true,
                    canAccessFleet: true,
                    canAccessTeam: true,
                    canAccessFinance: true,
                    canAccessNotificationsStudio: true,
                    canAccessSettings: true,
                    canEditRentals: true,
                    canEditOperations: true,
                    canEditDumpsters: true,
                    canEditFleet: true,
                });
                
                const newAccountRef = firestore.doc(`accounts/${determinedAccountId}`);
                transaction.set(newAccountRef, {
                    ownerId: uid,
                    createdAt: FieldValue.serverTimestamp(),
                    members: [uid],
                    rentalCounter: 0,
                    operationCounter: 0,
                });
            }

            // Set custom claims in Firebase Auth. This is critical for security rules.
            await adminAuth.setCustomUserClaims(uid, { accountId: determinedAccountId, role });

            // Create the user document in Firestore.
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
        
        // If we created a new Auth user but the transaction failed, we should delete the Auth user.
        if (isNewUser && userRecord) {
            try {
                await adminAuth.deleteUser(userRecord.uid);
                console.log(`Usuário Auth ${userRecord.uid} limpo com sucesso após falha na transação.`);
            } catch (deleteError) {
                 console.error(`CRÍTICO: Falha ao limpar o usuário Auth ${userRecord.uid} após falha na transação. Por favor, delete manualmente. Erro: ${deleteError}`);
            }
        }

        throw new Error(`Falha ao criar usuário e conta: ${error instanceof Error ? error.message : String(error)}`);
    }
}
