
'use client';
import type { Dumpster, Client, Rental, FirestoreEntity, DumpsterStatus, PopulatedRental, CompletedRental, PopulatedCompletedRental, UserAccount } from './types';
import { getFirebase } from './firebase';
import { collection, getDocs, doc, updateDoc, writeBatch, getDoc, Timestamp, where, onSnapshot, query, deleteDoc } from 'firebase/firestore';
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
