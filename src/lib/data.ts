'use server';
import type { Dumpster, Client, Rental, FirestoreEntity } from './types';
import { db, auth } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, writeBatch, getDoc, Timestamp, where } from 'firebase/firestore';

// --- Generic Firestore Functions ---

async function getCollection<T extends FirestoreEntity>(collectionName: string): Promise<T[]> {
  // On the server, auth.currentUser is null. We must rely on the AuthProvider on the client
  // to handle redirection for unauthenticated users. Returning an empty array prevents
  // the server component from crashing during its initial render.
  if (!auth.currentUser?.uid) {
    return [];
  }
  const userId = auth.currentUser.uid;
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

async function addDocument<T>(userId: string, collectionName: string, data: T) {
    if (!userId) throw new Error("Usuário não autenticado.");
    const docRef = await addDoc(collection(db, 'users', userId, collectionName), data as any);
    return { id: docRef.id, ...data };
}

async function updateDocument<T extends { id: string }>(userId: string, collectionName: string, data: Partial<T>) {
  if (!userId) throw new Error("Usuário não autenticado.");
  const { id, ...rest } = data;
  if (!id) throw new Error("ID do documento não fornecido para atualização.");
  const docRef = doc(db, 'users', userId, collectionName, id);
  await updateDoc(docRef, rest);
  return data;
}

async function deleteDocument(userId: string, collectionName: string, id: string) {
    if (!userId) throw new Error("Usuário não autenticado.");
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

export const addDumpster = async (userId: string, dumpster: Omit<Dumpster, 'id'>) => {
  return await addDocument(userId, 'dumpsters', dumpster);
};

export const updateDumpster = async (userId: string, dumpster: Partial<Dumpster>) => {
  return await updateDocument(userId, 'dumpsters', dumpster);
}

export const deleteDumpster = async (userId: string, id: string) => {
    const q = query(collection(db, 'users', userId, 'rentals'), where('dumpsterId', '==', id), where('status', '==', 'Ativo'));
    const activeRentalsSnapshot = await getDocs(q);

    if (!activeRentalsSnapshot.empty) {
        throw new Error('Não é possível excluir uma caçamba que está atualmente alugada.');
    }
    
    return await deleteDocument(userId, 'dumpsters', id);
}


export const addClient = async (userId: string, client: Omit<Client, 'id'>) => {
  return await addDocument(userId, 'clients', client);
};

export const updateClient = async (userId: string, client: Client) => {
  return await updateDocument(userId, 'clients', client);
}

export const deleteClient = async (userId: string, id: string) => {
    const q = query(collection(db, 'users', userId, 'rentals'), where('clientId', '==', id), where('status', '==', 'Ativo'));
    const activeRentalsSnapshot = await getDocs(q);

    if (!activeRentalsSnapshot.empty) {
        throw new Error('Não é possível excluir um cliente com aluguéis ativos. Finalize os aluguéis primeiro.');
    }

    return await deleteDocument(userId, 'clients', id);
}


export const addRental = async (userId: string, rental: Omit<Rental, 'id'>) => {
    const newRental = await addDocument(userId, 'rentals', rental);
    
    // Update dumpster status to 'Alugada'
    await updateDumpster(userId, { id: rental.dumpsterId, status: 'Alugada' });
    
    return newRental;
};

export const updateRental = async (userId: string, rental: Partial<Rental>) => {
    if(!rental.id) throw new Error("ID do aluguel não fornecido.");

    const existingRentalRef = doc(db, 'users', userId, 'rentals', rental.id);
    const existingRental = await getDoc(existingRentalRef);
    
    if(!existingRental.exists()) {
       throw new Error('Aluguel não encontrado.');
    }
    const existingRentalData = existingRental.data() as Rental;
    

    // Convert Firestore Timestamp to Date for comparison if needed
    const rentalDate = existingRentalData.rentalDate instanceof Timestamp 
        ? existingRentalData.rentalDate.toDate() 
        : existingRentalData.rentalDate;

    if (rental.returnDate && rental.returnDate < rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }

    return await updateDocument(userId, 'rentals', rental);
};


export const completeRental = async (userId: string, rentalId: string, dumpsterId: string) => {
  const batch = writeBatch(db);
  
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
