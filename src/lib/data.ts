'use server';
import type { Dumpster, Client, Rental, FirestoreEntity, DumpsterStatus, PopulatedRental } from './types';
import { db, auth } from './firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, writeBatch, getDoc, Timestamp, where } from 'firebase/firestore';

// --- Generic Firestore Functions (CLIENT-SIDE) ---

async function getCollection<T extends FirestoreEntity>(collectionName: string): Promise<T[]> {
  if (!auth.currentUser?.uid) {
    return [];
  }
  const userId = auth.currentUser.uid;
  const q = query(collection(db, 'users', userId, collectionName));
  try {
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
  } catch (error) {
    console.error(`Error getting ${collectionName}:`, error);
    // On server render, if auth isn't ready, it might throw a permission error.
    // Return empty array to prevent crashing the page. The client-side will re-fetch.
    return [];
  }
}


async function updateDocument<T extends { id: string }>(userId: string, collectionName: string, data: Partial<T>) {
  if (!userId) throw new Error("Usuário não autenticado.");
  const { id, ...rest } = data;
  if (!id) throw new Error("ID do documento não fornecido para atualização.");
  const docRef = doc(db, 'users', userId, collectionName, id);
  await updateDoc(docRef, rest);
  return data;
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


// --- CLIENT-SIDE Data Mutation Functions ---

export const updateDumpsterStatus = async (userId: string, id: string, status: DumpsterStatus) => {
    return await updateDocument(userId, 'dumpsters', { id, status });
}

export const updateRental = async (userId: string, rental: Partial<Rental>) => {
    if(!rental.id) throw new Error("ID do aluguel não fornecido.");

    const existingRentalRef = doc(db, 'users', userId, 'rentals', rental.id);
    const existingRental = await getDoc(existingRentalRef);
    
    if(!existingRental.exists()) {
       throw new Error('Aluguel não encontrado.');
    }
    const existingRentalData = existingRental.data() as Rental;
    
    const rentalDate = existingRentalData.rentalDate instanceof Timestamp 
        ? existingRentalData.rentalDate.toDate() 
        : existingRentalData.rentalDate;

    if (rental.returnDate && rental.returnDate < rentalDate) {
        throw new Error('A data de devolução não pode ser anterior à data de aluguel.');
    }

    return await updateDocument(userId, 'rentals', rental);
};

// This function performs writes and should probably be a server-side only action,
// but for now we keep it here as it's complex.
export const completeRental = async (userId: string, rentalId: string, dumpsterId: string) => {
  const batch = writeBatch(db);
  
  const rentalRef = doc(db, 'users', userId, 'rentals', rentalId);
  batch.update(rentalRef, { status: 'Concluído' });

  const dumpsterRef = doc(db, 'users', userId, 'dumpsters', dumpsterId);
  batch.update(dumpsterRef, { status: 'Disponível' });

  await batch.commit();
  
  const updatedRentalDoc = await getDoc(rentalRef);
  const updatedRental = updatedRentalDoc.data();
  return { id: rentalId, ...updatedRental } as Rental;
};
