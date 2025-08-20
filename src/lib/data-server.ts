// This file is server-only and uses the Firebase Admin SDK
import { adminDb } from './firebase-admin';
import type { Client, Dumpster, Rental } from './types';

// --- Generic Functions ---

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
    // You might want to add a check here for active rentals before deleting
    return deleteDocument(userId, 'dumpsters', docId);
}

// Rentals
export async function addRental(userId: string, rental: Omit<Rental, 'id'>) {
  return addDocument(userId, 'rentals', rental);
}
