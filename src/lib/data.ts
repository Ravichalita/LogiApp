'use server';
import type { Dumpster, Client, Rental, FirestoreEntity } from './types';
import { db, auth } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

async function getUserId(): Promise<string> {
  const user = auth.currentUser;
  // This check is crucial. In a real app, you might want to handle this more gracefully,
  // but for server actions, throwing an error is often appropriate as it should be
  // called from an authenticated context.
  if (!user) {
    throw new Error('Usuário não autenticado. Acesso negado.');
  }
  return user.uid;
}

// --- Generic Firestore Functions ---

async function getCollection<T extends FirestoreEntity>(collectionName: string): Promise<T[]> {
  const userId = await getUserId();
  const q = query(collection(db, 'users', userId, collectionName));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    // Convert Firestore Timestamps back to JS Dates
    for (const key in data) {
      if (data[key] instanceof Timestamp) {
        data[key] = data[key].toDate();
      }
    }
    return { id: doc.id, ...data } as T;
  });
}

async function addDocument<T>(collectionName: string, data: T) {
    const userId = await getUserId();
    // Don't spread userId into the document itself, it's part of the path
    const docRef = await addDoc(collection(db, 'users', userId, collectionName), data as any);
    return { id: docRef.id, ...data };
}

async function updateDocument<T extends { id: string }>(collectionName: string, data: Partial<T>) {
  const userId = await getUserId();
  const { id, ...rest } = data;
  if (!id) throw new Error("ID do documento não fornecido para atualização.");
  const docRef = doc(db, 'users', userId, collectionName, id);
  await updateDoc(docRef, rest);
  return data;
}

async function deleteDocument(collectionName: string, id: string) {
    const userId = await getUserId();
    const docRef = doc(db, 'users', userId, collectionName, id);
    await deleteDoc(docRef);
    return { success: true };
}


// --- Data Retrieval Functions ---

export const getDumpsters = async (): Promise<Dumpster[]> => {
  return await getCollection<Dumpster>('dumpsters');
};

export const getClients = async (): Promise<Client[]> => {
  return await getCollection<Client>('clients');
};

export const getRentals = async (): Promise<Rental[]> => {
  return await getCollection<Rental>('rentals');
};

// --- Data Mutation Functions ---

export const addDumpster = async (dumpster: Omit<Dumpster, 'id'>) => {
  return await addDocument('dumpsters', dumpster);
};

export const updateDumpster = async (dumpster: Partial<Dumpster>) => {
  return await updateDocument('dumpsters', dumpster);
}

export const deleteDumpster = async (id: string) => {
    const rentals = await getRentals();
    const dumpsterIsRented = rentals.some(r => r.dumpsterId === id && r.status === 'Ativo');

    if (dumpsterIsRented) {
        throw new Error('Não é possível excluir uma caçamba que está atualmente alugada.');
    }
    
    return await deleteDocument('dumpsters', id);
}


export const addClient = async (client: Omit<Client, 'id'>) => {
  return await addDocument('clients', client);
};

export const updateClient = async (client: Client) => {
  return await updateDocument('clients', client);
}

export const deleteClient = async (id: string) => {
    const rentals = await getRentals();
    const hasActiveRentals = rentals.some(r => r.clientId === id && r.status === 'Ativo');
    
    if (hasActiveRentals) {
        throw new Error('Não é possível excluir um cliente com aluguéis ativos. Finalize os aluguéis primeiro.');
    }

    return await deleteDocument('clients', id);
}


export const addRental = async (rental: Omit<Rental, 'id'>) => {
    const newRental = await addDocument('rentals', rental);
    
    // Update dumpster status to 'Alugada'
    await updateDumpster({ id: rental.dumpsterId, status: 'Alugada' });
    
    return newRental;
};

export const updateRental = async (rental: Partial<Rental>) => {
    const userId = await getUserId();
    const existingRental = await getDoc(doc(db, 'users', userId, 'rentals', rental.id!));
    const existingRentalData = existingRental.data() as Rental;
    
    if (!existingRentalData) {
        throw new Error('Aluguel não encontrado.');
    }

    // Convert Firestore Timestamp to Date for comparison if needed
    const rentalDate = existingRentalData.rentalDate instanceof Timestamp 
        ? existingRentalData.rentalDate.toDate() 
        : existingRentalData.rentalDate;

    if (rental.returnDate && rental.returnDate < rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }

    return await updateDocument('rentals', rental);
};


export const completeRental = async (rentalId: string, dumpsterId: string) => {
  const batch = writeBatch(db);
  const userId = await getUserId();

  // Update rental status to 'Concluído'
  const rentalRef = doc(db, 'users', userId, 'rentals', rentalId);
  batch.update(rentalRef, { status: 'Concluído' });

  // Update dumpster status to 'Disponível'
  const dumpsterRef = doc(db, 'users', userId, 'dumpsters', dumpsterId);
  batch.update(dumpsterRef, { status: 'Disponível' });

  await batch.commit();
  
  const updatedRentalDoc = await getDoc(rentalRef);
  const updatedRental = updatedRentalDoc.data();
  return { id: rentalId, ...updatedRental } as Rental;
};
