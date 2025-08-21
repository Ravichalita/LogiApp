
'use server';

// This file is server-only and uses the Firebase Admin SDK for special cases like user creation.
import { adminDb } from './firebase-server';
import type { Client, Dumpster, Rental, CompletedRental } from './types';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, writeBatch, Timestamp, getDocs } from 'firebase/firestore';
import { getFirebase } from './firebase';

const { db } = getFirebase();

// --- Generic Functions ---
// These use the CLIENT SDK and are fine for Server Actions, as they run under the user's context.

async function getDocumentById(accountId: string, collectionName: string, docId: string) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = doc(db, 'accounts', accountId, collectionName, docId);
    const docSnap = await getDoc(ref);

    if (!docSnap.exists()) {
        return null;
    }

    const data = docSnap.data();
    // Convert Firestore Timestamps back to JS Dates for consistency
     for (const key in data) {
        if (data[key] instanceof Timestamp) {
          data[key] = data[key].toDate();
        }
      }
    return { id: docSnap.id, ...data };
}

async function addDocument(accountId: string, collectionName: string, data: any) {
  if (!accountId) throw new Error('Conta não identificada.');
  
  const ref = await addDoc(
    collection(db, 'accounts', accountId, collectionName),
    {
      ...data,
      createdAt: new Date(),
    }
  );
  return { id: ref.id };
}

async function updateDocument(accountId: string, collectionName: string, docId: string, data: any) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = doc(db, 'accounts', accountId, collectionName, docId);
    await updateDoc(ref, data);
    return { id: docId, ...data};
}

async function deleteDocument(accountId: string, collectionName: string, docId: string) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');
    
    const ref = doc(db, 'accounts', accountId, collectionName, docId);
    await deleteDoc(ref);
    return { success: true };
}


// --- Specific Functions ---

// Called from a server action during signup.
// THIS MUST USE THE ADMIN SDK TO BYPASS SECURITY RULES for initial user/account creation.
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


// Clients
export async function addClient(accountId: string, client: Omit<Client, 'id'>) {
  return addDocument(accountId, 'clients', client);
}
export async function updateClient(accountId: string, client: Client) {
    const { id, ...data } = client;
    return updateDocument(accountId, 'clients', id, data);
}
export async function deleteClient(accountId: string, docId: string) {
    // You might want to add a check here for active rentals before deleting
    return deleteDocument(accountId, 'clients', docId);
}

// Dumpsters
export async function addDumpster(accountId: string, dumpster: Omit<Dumpster, 'id'>) {
  return addDocument(accountId, 'dumpsters', dumpster);
}
export async function updateDumpster(accountId: string, dumpster: Dumpster) {
    const { id, ...data } = dumpster;
    return updateDocument(accountId, 'dumpsters', id, data);
}
export async function deleteDumpster(accountId: string, docId: string) {
    return deleteDocument(accountId, 'dumpsters', docId);
}

// Rentals
export async function addRental(accountId: string, rental: Omit<Rental, 'id'>) {
    if (!accountId) throw new Error('Conta não identificada.');
    return addDocument(accountId, 'rentals', rental);
}

export async function cancelRental(accountId: string, rentalId: string) {
    return deleteDocument(accountId, 'rentals', rentalId);
}

export async function getRentalById(accountId: string, rentalId: string): Promise<Rental | null> {
    return getDocumentById(accountId, 'rentals', rentalId) as Promise<Rental | null>;
}


export async function updateRental(accountId: string, rentalId: string, data: Partial<Rental>) {
  return await updateDocument(accountId, 'rentals', rentalId, data);
}

export async function completeRental(accountId: string, rentalId: string, completedRentalData: Omit<CompletedRental, 'id'>) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!rentalId) throw new Error('ID do aluguel ausente.');

    const batch = writeBatch(db);

    const rentalRef = doc(db, 'accounts', accountId, 'rentals', rentalId);
    batch.delete(rentalRef);

    const completedRentalRef = doc(collection(db, 'accounts', accountId, 'completedRentals'));
    batch.set(completedRentalRef, completedRentalData);


    await batch.commit();
}

export async function deleteAllCompletedRentals(accountId: string) {
    if (!accountId) throw new Error('Conta não identificada.');

    const collectionRef = collection(db, 'accounts', accountId, 'completedRentals');
    const snapshot = await getDocs(collectionRef);

    if (snapshot.empty) {
        return; 
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}
