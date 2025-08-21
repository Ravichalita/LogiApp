
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// This function must be inside the POST handler or be structured in a way
// that ensures it's only called on the server side when needed.
// The current approach moves initialization inside the POST handler.

/**
 * API route to create an account and a user document in Firestore.
 * This is called from the client-side after a user is successfully
 * created in Firebase Auth.
 */
export async function POST(request: Request) {
  try {
    // Ensure Firebase Admin is initialized for every API call
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: "caambacontrol3",
        });
    }
    const adminDb = admin.firestore();

    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ success: false, error: 'User ID and email are required.' }, { status: 400 });
    }

    const batch = adminDb.batch();

    // 1. Create a new account document
    const accountRef = adminDb.collection('accounts').doc();
    batch.set(accountRef, {
      ownerId: userId,
      name: `${email}'s Account`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Create the user document and link it to the new account
    const userRef = adminDb.collection('users').doc(userId);
    batch.set(userRef, {
      email: email,
      accountId: accountRef.id,
      role: 'admin',
    });

    // 3. Commit the batch
    await batch.commit();

    return NextResponse.json({ success: true, accountId: accountRef.id }, { status: 201 });

  } catch (error) {
    console.error('Error creating user account in API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: `Failed to create user account in database: ${errorMessage}` }, { status: 500 });
  }
}
