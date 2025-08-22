
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
  collectionGroup,
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
export function getPopulatedCompletedRentals(accountId: string, callback: (rentals: PopulatedCompletedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/completed_rentals`);
    const q = query(rentalsCollection, where("accountId", "==", accountId), orderBy('completedDate', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rentals = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Firestore timestamps need to be converted to JS dates
            const completedDate = data.completedDate?.toDate ? data.completedDate.toDate() : new Date();
            return {
                id: doc.id,
                ...data,
                completedDate: completedDate,
            } as CompletedRental;
        });

        const populatePromises = rentals.map(async (rental) => {
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
                return null; // Return null for failed population
            }
        });

        Promise.all(populatePromises).then(populatedResults => {
            const validPopulatedRentals = populatedResults.filter(
                (r): r is PopulatedCompletedRental => r !== null && !!r.client && !!r.dumpster
            );
            callback(validPopulatedRentals);
        }).catch(error => {
            console.error("Error in Promise.all for populating rentals:", error);
            callback([]); // On error, return empty array
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
  
  // This function listens for changes to the account document itself.
  const accountRef = doc(db, 'accounts', accountId);
  
  const unsubscribe = onSnapshot(accountRef, async (accountSnap) => {
    if (!accountSnap.exists()) {
      console.warn(`Account document ${accountId} does not exist.`);
      callback([]);
      return;
    }
    
    // Get the list of member IDs from the account document.
    const memberIds = accountSnap.data()?.members as string[] || [];
    if (memberIds.length === 0) {
      callback([]);
      return;
    }

    try {
      // Create a promise to fetch each user's document based on their ID.
      const memberPromises = memberIds.map(id => getDoc(doc(db, 'users', id)));
      const memberDocSnaps = await Promise.all(memberPromises);
      
      // Filter out any documents that don't exist and map the data.
      const users = memberDocSnaps
        .filter(docSnap => docSnap.exists())
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as UserAccount));
        
      const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));
      callback(sortedUsers);
    } catch (error) {
        console.error("Error fetching team members' documents:", error);
        callback([]);
    }
  }, (error) => {
      console.error("Error fetching account document:", error);
      callback([]);
  });

  return unsubscribe;
}
// #endregion
