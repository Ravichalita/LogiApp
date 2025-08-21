
// This file is server-only and uses the Firebase Admin SDK
import { adminDb } from './firebase-admin';
import type { Client, Dumpster, PopulatedRental, Rental, DumpsterStatus, CompletedRental } from './types';
import { onSnapshot, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

// --- Generic Functions ---

async function getDocumentById(userId: string, collectionName: string, docId: string) {
    if (!userId) throw new Error('Usuário não autenticado.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = adminDb.collection('users').doc(userId).collection(collectionName).doc(docId);
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

async function addDocument(userId: string, collectionName: string, data: any) {
  if (!userId) throw new Error('Usuário não autenticado.');
  
  const ref = await adminDb
    .collection('users')
    .doc(userId)
    .collection(collectionName)
    .add({
      ...data,
      createdAt: new Date(), // Optional: add a creation timestamp
    });
  return { id: ref.id };
}

async function updateDocument(userId: string, collectionName: string, docId: string, data: any) {
    if (!userId) throw new Error('Usuário não autenticado.');
    if (!docId) throw new Error('ID do documento não fornecido.');

    const ref = adminDb.collection('users').doc(userId).collection(collectionName).doc(docId);
    await ref.update(data);
    return { id: docId, ...data};
}

async function deleteDocument(userId: string, collectionName: string, docId: string) {
    if (!userId) throw new Error('Usuário não autenticado.');
    if (!docId) throw new Error('ID do documento não fornecido.');
    
    const ref = adminDb.collection('users').doc(userId).collection(collectionName).doc(docId);
    await ref.delete();
    return { success: true };
}


// --- Specific Functions ---

// Clients
export async function addClient(userId: string, client: Omit<Client, 'id'>) {
  return addDocument(userId, 'clients', client);
}
export async function updateClient(userId: string, client: Client) {
    const { id, ...data } = client;
    return updateDocument(userId, 'clients', id, data);
}
export async function deleteClient(userId: string, docId: string) {
    // You might want to add a check here for active rentals before deleting
    return deleteDocument(userId, 'clients', docId);
}

// Dumpsters
export async function addDumpster(userId: string, dumpster: Omit<Dumpster, 'id'>) {
  return addDocument(userId, 'dumpsters', dumpster);
}
export async function updateDumpster(userId: string, dumpster: Dumpster) {
    const { id, ...data } = dumpster;
    return updateDocument(userId, 'dumpsters', id, data);
}
export async function deleteDumpster(userId: string, docId: string) {
    return deleteDocument(userId, 'dumpsters', docId);
}

// Rentals
export async function addRental(userId: string, rental: Omit<Rental, 'id'>, dumpsterId: string) {
  if (!userId) throw new Error('Usuário não autenticado.');

  const batch = adminDb.batch();

  // 1. Add the new rental document
  const rentalRef = adminDb.collection('users').doc(userId).collection('rentals').doc();
  batch.set(rentalRef, { ...rental, createdAt: new Date() });

  // 2. Update the dumpster's status to 'Alugada'
  const dumpsterRef = adminDb.collection('users').doc(userId).collection('dumpsters').doc(dumpsterId);
  batch.update(dumpsterRef, { status: 'Alugada' });

  await batch.commit();

  return { id: rentalRef.id };
}

export async function deleteRental(userId: string, rentalId: string) {
    return deleteDocument(userId, 'rentals', rentalId);
}

export async function getRentalById(userId: string, rentalId: string): Promise<Rental | null> {
    return getDocumentById(userId, 'rentals', rentalId) as Promise<Rental | null>;
}


export async function updateRental(userId: string, rentalId: string, data: Partial<Rental>) {
  return await updateDocument(userId, 'rentals', rentalId, data);
}

export async function completeRental(userId: string, rentalId: string, dumpsterId: string, completedRentalData: Omit<CompletedRental, 'id'>) {
    if (!userId) throw new Error('Usuário não autenticado.');
    if (!rentalId || !dumpsterId) throw new Error('IDs de aluguel ou caçamba ausentes.');

    const batch = adminDb.batch();

    // 1. Delete the active rental document
    const rentalRef = adminDb.collection('users').doc(userId).collection('rentals').doc(rentalId);
    batch.delete(rentalRef);

    // 2. Set the dumpster status back to 'Disponível'
    const dumpsterRef = adminDb.collection('users').doc(userId).collection('dumpsters').doc(dumpsterId);
    batch.update(dumpsterRef, { status: 'Disponível' });

    // 3. Create a new record in the 'completedRentals' collection for statistics
    const completedRentalRef = adminDb.collection('users').doc(userId).collection('completedRentals').doc();
    batch.set(completedRentalRef, completedRentalData);


    await batch.commit();
}

export async function deleteAllCompletedRentals(userId: string) {
    if (!userId) throw new Error('Usuário não autenticado.');

    const collectionRef = adminDb.collection('users').doc(userId).collection('completedRentals');
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
