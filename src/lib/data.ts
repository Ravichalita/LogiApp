
'use client';
import type { Dumpster, Client, Rental, FirestoreEntity, DumpsterStatus, PopulatedRental, CompletedRental, PopulatedCompletedRental, UserAccount } from './types';
import { getFirebase } from './firebase';
import { collection, getDocs, doc, updateDoc, writeBatch, getDoc, Timestamp, where, onSnapshot, query, deleteDoc, addDoc } from 'firebase/firestore';
import { startOfToday } from 'date-fns';

const { db } = getFirebase();

// --- Generic Firestore Functions (CLIENT-SIDE) ---

// Used for real-time updates (listeners)
function getCollection<T extends FirestoreEntity>(accountId: string, callback: (data: T[]) => void, collectionName: string, q?: any) {
  if (!accountId) {
    console.log("getCollection called without accountId, returning empty array.");
    callback([]);
    return () => {}; // Return an empty unsubscribe function
  }
  const collectionQuery = q || query(collection(db, 'accounts', accountId, collectionName));
  
  const unsubscribe = onSnapshot(collectionQuery, (querySnapshot) => {
    const data = querySnapshot.docs.map(doc => {
      const docData = doc.data();
      // Convert Firestore Timestamps back to JS Dates
      for (const key in docData) {
        if (docData[key] instanceof Timestamp) {
          docData[key] = docData[key].toDate();
        }
      }
      return { id: doc.id, ...docData } as T;
    });
    callback(data);
  }, (error) => {
    console.error(`Error getting ${collectionName}:`, error);
    callback([]);
  });

  return unsubscribe;
}

// Used for one-time data fetching
async function fetchCollection<T extends FirestoreEntity>(accountId: string, collectionName: string): Promise<T[]> {
  if (!accountId) {
    console.log("fetchCollection called without accountId, returning empty array.");
    return [];
  }
  const q = query(collection(db, 'accounts', accountId, collectionName));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const docData = doc.data();
    for (const key in docData) {
      if (docData[key] instanceof Timestamp) {
        docData[key] = docData[key].toDate();
      }
    }
    return { id: doc.id, ...docData } as T;
  });
}

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


// --- Data Retrieval Functions ---

export const getDumpsters = (accountId: string, callback: (dumpsters: Dumpster[]) => void) => {
  return getCollection<Dumpster>(accountId, callback, 'dumpsters');
};
export const fetchDumpsters = (accountId: string) => fetchCollection<Dumpster>(accountId, 'dumpsters');


export const getClients = (accountId: string, callback: (clients: Client[]) => void) => {
  return getCollection<Client>(accountId, callback, 'clients');
};
export const fetchClients = (accountId: string) => fetchCollection<Client>(accountId, 'clients');


export const getRentals = (accountId: string, callback: (rentals: PopulatedRental[]) => void) => {
  if (!accountId) {
    callback([]);
    return () => {};
  }
  
  const rentalsQuery = query(
    collection(db, 'accounts', accountId, 'rentals'),
    where('status', '==', 'Ativo')
  );

  return getCollection<Rental>(accountId, async (rentals) => {
     if (!rentals.length) {
      callback([]);
      return;
    }

    const clients = await fetchClients(accountId);
    const dumpsters = await fetchDumpsters(accountId);

    const populatedRentals = rentals.map(rental => {
      const client = clients.find(c => c.id === rental.clientId);
      const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
      if (!client || !dumpster) return null; 
      return { ...rental, client, dumpster };
    }).filter(Boolean) as PopulatedRental[];
    
    callback(populatedRentals.sort((a, b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime()));
  }, 'rentals', rentalsQuery);
};

export const getPendingRentals = (accountId: string, callback: (rentals: Rental[]) => void) => {
   if (!accountId) {
    callback([]);
    return () => {};
  }
   const rentalsQuery = query(collection(db, 'accounts', accountId, 'rentals'));
  return getCollection<Rental>(accountId, callback, 'rentals', rentalsQuery);
}

export const getCompletedRentals = (accountId: string, callback: (rentals: CompletedRental[]) => void) => {
    return getCollection<CompletedRental>(accountId, callback, 'completedRentals');
};

export const getPopulatedCompletedRentals = (accountId: string, callback: (rentals: PopulatedCompletedRental[]) => void) => {
    return getCollection<CompletedRental>(accountId, async (completedRentals) => {
         if (!completedRentals.length) {
            callback([]);
            return;
        }

        const clients = await fetchClients(accountId);
        const dumpsters = await fetchDumpsters(accountId);

        const populatedData = completedRentals.map(rental => {
            const client = clients.find(c => c.id === rental.clientId);
            const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
            return { ...rental, client, dumpster };
        });
        
        callback(populatedData.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()));

    }, 'completedRentals');
}

// --- Data Writing Functions ---

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
