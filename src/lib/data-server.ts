
'use server';
import { adminDb } from './firebase-server';

// This file is intended for server-side actions that require admin privileges.
// It is NOT meant to be imported into client components.

/**
 * Creates an account and a user document in a single batch operation using the Admin SDK.
 * This is typically called from a server action after a new user signs up.
 * @param userId - The Firebase Auth UID of the new user.
 * @param email - The email of the new user.
 */
export async function createAccountForNewUser(userId: string, email: string) {
    try {
        const batch = adminDb.batch();

        // 1. Create a new account document and get its ref
        const accountRef = adminDb.collection('accounts').doc();
        batch.set(accountRef, {
            ownerId: userId,
            name: `${email}'s Account`,
            createdAt: new Date(),
        });
        
        // 2. Create the user document and link it to the new account ID
        const userRef = adminDb.collection('users').doc(userId);
        batch.set(userRef, {
            email: email,
            accountId: accountRef.id,
            role: 'admin', // First user is always an admin
        });
        
        // 3. Commit the atomic batch
        await batch.commit();

    } catch(error) {
        console.error("Error creating account and user document with Admin SDK:", error);
        throw new Error("Falha ao salvar informações do usuário no banco de dados.");
    }
}
