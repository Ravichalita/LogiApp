
'use client';

import {
  collection,
  query,
  onSnapshot,
  orderBy,
  getDocs,
  doc,
  getDoc,
  where,
} from 'firebase/firestore';
import { getFirebase } from './firebase-client';
import type { Client, Dumpster, Rental, CompletedRental, PopulatedCompletedRental, PopulatedRental, UserAccount } from './types';

type Unsubscribe = () => void;

const { db } = getFirebase();

// #region Client Data
export function getClients(accountId: string, callback: (clients: Client[]) => void): Unsubscribe {
  const clientsCollection = collection(db, `accounts/${accountId}/clients`);
  const q = query(clientsCollection, orderBy('name', 'asc'));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const clients = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Client));
    callback(clients);
  });

  return unsubscribe;
}

export async function fetchClients(accountId: string): Promise<Client[]> {
    const clientsCollection = collection(db, `accounts/${accountId}/clients`);
    const q = query(clientsCollection, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
}

// #endregion


// #region Dumpster Data
export function getDumpsters(accountId: string, callback: (dumpsters: Dumpster[]) => void): Unsubscribe {
    const dumpstersCollection = collection(db, `accounts/${accountId}/dumpsters`);
    const q = query(dumpstersCollection, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const dumpsters = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Dumpster));
        callback(dumpsters);
    });

    return unsubscribe;
}
// #endregion

// #region Rental Data
export function getRentals(accountId: string, callback: (rentals: Rental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, orderBy('rentalDate', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rentals = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert Firestore Timestamps to ISO strings
                rentalDate: data.rentalDate?.toDate ? data.rentalDate.toDate().toISOString() : data.rentalDate,
                returnDate: data.returnDate?.toDate ? data.returnDate.toDate().toISOString() : data.returnDate,
            } as Rental;
        });
        callback(rentals);
    });

    return unsubscribe;
}

export function getPopulatedRentals(accountId: string, callback: (rentals: PopulatedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, orderBy('rentalDate', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const rentalPromises = querySnapshot.docs.map(async (rentalDoc) => {
            const rentalData = rentalDoc.data() as Omit<Rental, 'id'>;

            const dumpsterPromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, rentalData.dumpsterId));
            const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rentalData.clientId));

            const [dumpsterSnap, clientSnap] = await Promise.all([dumpsterPromise, clientPromise]);

            return {
                id: rentalDoc.id,
                ...rentalData,
                 rentalDate: rentalData.rentalDate?.toDate ? rentalData.rentalDate.toDate().toISOString() : rentalData.rentalDate,
                returnDate: rentalData.returnDate?.toDate ? rentalData.returnDate.toDate().toISOString() : rentalData.returnDate,
                dumpster: dumpsterSnap.exists() ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
                client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
            };
        });

        const populatedRentals = await Promise.all(rentalPromises);
        callback(populatedRentals.filter(r => r.client && r.dumpster)); // Filter out rentals with missing relations
    });

    return unsubscribe;
}
// #endregion

// #region Completed Rental Data
export function getCompletedRentals(accountId: string, callback: (rentals: CompletedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/completed_rentals`);
    const q = query(rentalsCollection, orderBy('completedDate', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rentals = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                completedDate: data.completedDate.toDate(),
            } as CompletedRental;
        });
        callback(rentals);
    });

    return unsubscribe;
}


export function getPopulatedCompletedRentals(accountId: string, callback: (rentals: PopulatedCompletedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/completed_rentals`);
    const q = query(rentalsCollection, orderBy('completedDate', 'desc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const rentalPromises = querySnapshot.docs.map(async (rentalDoc) => {
            const rentalData = rentalDoc.data() as Omit<CompletedRental, 'id' | 'completedDate'> & { completedDate: any };

            const dumpsterPromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, rentalData.dumpsterId));
            const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rentalData.clientId));

            const [dumpsterSnap, clientSnap] = await Promise.all([dumpsterPromise, clientPromise]);

            return {
                id: rentalDoc.id,
                ...rentalData,
                completedDate: rentalData.completedDate.toDate(),
                dumpster: dumpsterSnap.exists() ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
                client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
            };
        });

        const populatedRentals = await Promise.all(rentalPromises);
        callback(populatedRentals.filter(r => r.client && r.dumpster)); // Filter out rentals with missing relations
    });

    return unsubscribe;
}
// #endregion

// #region User/Team Data
export function getTeamMembers(accountId: string, callback: (users: UserAccount[]) => void): Unsubscribe {
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, where('accountId', '==', accountId), orderBy('name', 'asc'));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserAccount));
    callback(users);
  });

  return unsubscribe;
}
// #endregion
