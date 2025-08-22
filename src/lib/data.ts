
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
  const q = query(clientsCollection, where("accountId", "==", accountId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const clients = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Client));
    const sortedClients = clients.sort((a, b) => a.name.localeCompare(b.name));
    callback(sortedClients);
  }, (error) => {
      console.error("Error fetching clients:", error);
      callback([]);
  });

  return unsubscribe;
}

export async function fetchClients(accountId: string): Promise<Client[]> {
    const clientsCollection = collection(db, `accounts/${accountId}/clients`);
    const q = query(clientsCollection, where("accountId", "==", accountId));
    const querySnapshot = await getDocs(q);
    const clients = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
    return clients.sort((a, b) => a.name.localeCompare(b.name));
}

// #endregion


// #region Dumpster Data
export function getDumpsters(accountId: string, callback: (dumpsters: Dumpster[]) => void): Unsubscribe {
    const dumpstersCollection = collection(db, `accounts/${accountId}/dumpsters`);
    const q = query(dumpstersCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const dumpsters = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Dumpster));
        callback(dumpsters);
    }, (error) => {
        console.error("Error fetching dumpsters:", error);
        callback([]);
    });

    return unsubscribe;
}
// #endregion

// #region Rental Data
export function getRentals(accountId: string, callback: (rentals: Rental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rentals = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                rentalDate: data.rentalDate?.toDate ? data.rentalDate.toDate().toISOString() : data.rentalDate,
                returnDate: data.returnDate?.toDate ? data.returnDate.toDate().toISOString() : data.returnDate,
            } as Rental;
        });
        callback(rentals);
    }, (error) => {
        console.error("Error fetching rentals:", error);
        callback([]);
    });

    return unsubscribe;
}

export function getPopulatedRentals(accountId: string, callback: (rentals: PopulatedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, where("accountId", "==", accountId));

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
        callback(populatedRentals.filter(r => r.client && r.dumpster));
    }, (error) => {
        console.error("Error fetching populated rentals:", error);
        callback([]);
    });

    return unsubscribe;
}
// #endregion

// #region Completed Rental Data
export function getPopulatedCompletedRentals(callback: (rentals: PopulatedCompletedRental[]) => void): Unsubscribe {
    // This query now fetches across all accounts, as per the open security rule.
    const rentalsCollectionGroup = collectionGroup(db, 'completed_rentals');

    const unsubscribe = onSnapshot(rentalsCollectionGroup, (querySnapshot) => {
        if (querySnapshot.empty) {
            callback([]);
            return;
        }

        const rentals = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                completedDate: data.completedDate.toDate(),
            } as CompletedRental;
        });

        const populatePromises = rentals.map(async (rental) => {
            // We need to fetch the associated client/dumpster from the correct account.
            const accountId = rental.accountId;
            if (!accountId) {
                 console.error(`Rental ${rental.id} is missing an accountId.`);
                 return null;
            }
            try {
                const dumpsterPromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, rental.dumpsterId));
                const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rental.clientId));
                const [dumpsterSnap, clientSnap] = await Promise.all([dumpsterPromise, clientPromise]);

                return {
                    ...rental,
                    dumpster: dumpsterSnap.exists() ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
                    client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
                };
            } catch (error) {
                console.error(`Error populating rental ${rental.id}:`, error);
                return null;
            }
        });

        Promise.all(populatePromises).then(populatedResults => {
            const validPopulatedRentals = populatedResults.filter(
                (r): r is PopulatedCompletedRental => r !== null && !!r.client && !!r.dumpster
            );
            callback(validPopulatedRentals);
        }).catch(error => {
            console.error("Error in Promise.all for populating rentals:", error);
            callback([]);
        });

    }, (error) => {
        console.error("Error fetching populated completed rentals:", error);
        callback([]);
    });

    return unsubscribe;
}
// #endregion

// #region Team Data
export function getTeamMembers(accountId: string, callback: (users: UserAccount[]) => void): Unsubscribe {
  if (!accountId) {
    callback([]);
    return () => {};
  }
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, where('accountId', '==', accountId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserAccount));
    const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));
    callback(sortedUsers);
  }, (error) => {
      console.error("Error fetching team members:", error);
      callback([]);
  });

  return unsubscribe;
}
// #endregion