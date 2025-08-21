
// This file is server-only and uses the Firebase Admin SDK
import { adminDb } from './firebase-admin';
import type { Client, Dumpster, PopulatedRental, Rental, DumpsterStatus, CompletedRental } from './types';
import { onSnapshot, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// --- Generic Functions ---

async function getDocumentById(accountId: string, collectionName: string, docId: string) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = adminDb.collection('accounts').doc(accountId).collection(collectionName).doc(docId);
    const doc = await ref.get();

    if (!doc.exists) {
        return null;
    }

    const data = doc.data()!;
    // Convert Firestore Timestamps back to JS Dates for consistency
     for (const key in data) {
        if (data[key] instanceof Timestamp) {
          data[key] = data[key].toDate();
        }
      }
    return { id: doc.id, ...data };
}

async function addDocument(accountId: string, collectionName: string, data: any) {
  if (!accountId) throw new Error('Conta não identificada.');
  
  const ref = await adminDb
    .collection('accounts')
    .doc(accountId)
    .collection(collectionName)
    .add({
      ...data,
      createdAt: new Date(), // Optional: add a creation timestamp
    });
  return { id: ref.id };
}

async function updateDocument(accountId: string, collectionName: string, docId: string, data: any) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = adminDb.collection('accounts').doc(accountId).collection(collectionName).doc(docId);
    await ref.update(data);
    return { id: docId, ...data};
}

async function deleteDocument(accountId: string, collectionName: string, docId: string) {
    if (!accountId) throw new Error('Conta não identificada.');
    if (!docId) throw new Error('ID do documento não fornecido.');
    
    const ref = adminDb.collection('accounts').doc(accountId).collection(collectionName).doc(docId);
    await ref.delete();
    return { success: true };
}


// --- Specific Functions ---

// Called from a server action during signup
export async function createAccountForNewUser(userId: string, email: string) {
    try {
        // 1. Create a new account
        const accountRef = adminDb.collection('accounts').doc();
        await accountRef.set({
            ownerId: userId,
            name: `${email}'s Account`,
            createdAt: new Date(),
        });
        const accountId = accountRef.id;

        // 2. Create the user document and link it to the account
        const userRef = adminDb.collection('users').doc(userId);
        await userRef.set({
            email: email,
            accountId: accountId,
            role: 'admin', // First user is always an admin
        });
    } catch(error) {
        console.error("Error creating account and user document:", error);
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

    const batch = adminDb.batch();

    // 1. Delete the active rental document
    const rentalRef = adminDb.collection('accounts').doc(accountId).collection('rentals').doc(rentalId);
    batch.delete(rentalRef);

    // 2. Create a new record in the 'completedRentals' collection for statistics
    const completedRentalRef = adminDb.collection('accounts').doc(accountId).collection('completedRentals').doc();
    batch.set(completedRentalRef, completedRentalData);


    await batch.commit();
}

export async function deleteAllCompletedRentals(accountId: string) {
    if (!accountId) throw new Error('Conta não identificada.');

    const collectionRef = adminDb.collection('accounts').doc(accountId).collection('completedRentals');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        return; // Nothing to delete
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}
