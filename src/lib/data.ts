
'use client';
import type { Dumpster, Client, Rental, FirestoreEntity, DumpsterStatus, PopulatedRental, CompletedRental, PopulatedCompletedRental } from './types';
import { db, auth } from './firebase';
import { collection, getDocs, doc, updateDoc, writeBatch, getDoc, Timestamp, where, onSnapshot, query, deleteDoc } from 'firebase/firestore';

// --- Generic Firestore Functions (CLIENT-SIDE) ---

// Used for real-time updates (listeners)
function getCollection<T extends FirestoreEntity>(userId: string, callback: (data: T[]) => void, collectionName: string, q?: any) {
  if (!userId) {
    console.log("getCollection called without userId, returning empty array.");
    callback([]);
    return () => {}; // Return an empty unsubscribe function
  }
  const collectionQuery = q || query(collection(db, 'users', userId, collectionName));
  
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
async function fetchCollection<T extends FirestoreEntity>(userId: string, collectionName: string): Promise<T[]> {
  if (!userId) {
    console.log("fetchCollection called without userId, returning empty array.");
    return [];
  }
  const q = query(collection(db, 'users', userId, collectionName));
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

export const getDumpsters = (userId: string, callback: (dumpsters: Dumpster[]) => void) => {
  return getCollection<Dumpster>(userId, callback, 'dumpsters');
};
export const fetchDumpsters = (userId: string) => fetchCollection<Dumpster>(userId, 'dumpsters');


export const getClients = (userId: string, callback: (clients: Client[]) => void) => {
  return getCollection<Client>(userId, callback, 'clients');
};
export const fetchClients = (userId: string) => fetchCollection<Client>(userId, 'clients');


export const getRentals = (userId: string, callback: (rentals: PopulatedRental[]) => void) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const rentalsQuery = query(
    collection(db, 'users', userId, 'rentals'),
    where('status', '==', 'Ativo')
  );

  return getCollection<Rental>(userId, async (rentals) => {
     if (!rentals.length) {
      callback([]);
      return;
    }

    // Fetch clients and dumpsters once
    const clients = await fetchClients(userId);
    const dumpsters = await fetchDumpsters(userId);

    const populatedRentals = rentals.map(rental => {
      const client = clients.find(c => c.id === rental.clientId);
      const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
      if (!client || !dumpster) return null;
      return { ...rental, client, dumpster };
    }).filter(Boolean) as PopulatedRental[];
     callback(populatedRentals.sort((a, b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime()));
  }, 'rentals', rentalsQuery);
};

export const getPendingRentals = (userId: string, callback: (rentals: Rental[]) => void) => {
   if (!userId) {
    callback([]);
    return () => {};
  }
   const rentalsQuery = query(
    collection(db, 'users', userId, 'rentals'),
    where('rentalDate', '>', new Date())
  );
  return getCollection<Rental>(userId, callback, 'rentals', rentalsQuery);
}

export const getCompletedRentals = (userId: string, callback: (rentals: CompletedRental[]) => void) => {
    return getCollection<CompletedRental>(userId, callback, 'completedRentals');
};

export const getPopulatedCompletedRentals = (userId: string, callback: (rentals: PopulatedCompletedRental[]) => void) => {
    return getCollection<CompletedRental>(userId, async (completedRentals) => {
         if (!completedRentals.length) {
            callback([]);
            return;
        }

        const clients = await fetchClients(userId);
        const dumpsters = await fetchDumpsters(userId);

        const populatedData = completedRentals.map(rental => {
            const client = clients.find(c => c.id === rental.clientId);
            const dumpster = dumpsters.find(d => d.id === rental.dumpsterId);
            return { ...rental, client, dumpster };
        });
        
        callback(populatedData.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()));

    }, 'completedRentals');
}
