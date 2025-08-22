
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
  Query,
  DocumentData,
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

export function getPopulatedRentals(
    accountId: string, 
    callback: (rentals: PopulatedRental[]) => void,
    assignedToId?: string
): Unsubscribe {
    // Use a collection group query to fetch rentals across all accounts.
    const rentalsCollectionGroup = collectionGroup(db, 'rentals');
    
    // Base query filters by the user's account ID for security.
    let q: Query<DocumentData> = query(rentalsCollectionGroup, where("accountId", "==", accountId));
    
    // If assignedToId is provided (for viewers), add a filter for it.
    if (assignedToId) {
        q = query(q, where("assignedTo", "==", assignedToId));
    }

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const rentalPromises = querySnapshot.docs.map(async (rentalDoc) => {
            const rentalData = rentalDoc.data() as Omit<Rental, 'id'>;

            const dumpsterPromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, rentalData.dumpsterId));
            const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rentalData.clientId));
            const assignedToPromise = getDoc(doc(db, `users`, rentalData.assignedTo));

            const [dumpsterSnap, clientSnap, assignedToSnap] = await Promise.all([dumpsterPromise, clientPromise, assignedToPromise]);

            return {
                id: rentalDoc.id,
                ...rentalData,
                rentalDate: rentalData.rentalDate?.toDate ? rentalData.rentalDate.toDate().toISOString() : rentalData.rentalDate,
                returnDate: rentalData.returnDate?.toDate ? rentalData.returnDate.toDate().toISOString() : rentalData.returnDate,
                dumpster: dumpsterSnap.exists() ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
                client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
                assignedToUser: assignedToSnap.exists() ? { id: assignedToSnap.id, ...assignedToSnap.data() } as UserAccount : null,
            };
        });

        const populatedRentals = await Promise.all(rentalPromises);
        callback(populatedRentals.filter(r => r.client && r.dumpster && r.assignedToUser));
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
  const q = query(rentalsCollection, where("accountId", "==", accountId));

  const unsubscribe = onSnapshot(q, async (querySnapshot) => {
    const rentals: CompletedRental[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const completedDate = data.completedDate?.toDate ? data.completedDate.toDate() : new Date(data.completedDate);
      return {
        id: doc.id,
        ...data,
        completedDate: completedDate,
      } as CompletedRental;
    });

    if (rentals.length === 0) {
      callback([]);
      return;
    }

    try {
      const populatePromises = rentals.map(async (rental) => {
        const dumpsterPromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, rental.dumpsterId));
        const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rental.clientId));
        const [dumpsterSnap, clientSnap] = await Promise.all([dumpsterPromise, clientPromise]);

        return {
          ...rental,
          dumpster: dumpsterSnap.exists() ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
          client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
        };
      });

      const populatedResults = await Promise.all(populatePromises);
      const validPopulatedRentals = populatedResults.filter(
        (r): r is PopulatedCompletedRental => r !== null && !!r.client && !!r.dumpster
      );
      
      const sortedRentals = validPopulatedRentals.sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());
      
      callback(sortedRentals);

    } catch (error) {
      console.error("Error populating completed rentals:", error);
      callback([]);
    }
  }, (error) => {
    console.error("Error fetching completed rentals snapshot:", error);
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
  
  const accountRef = doc(db, 'accounts', accountId);
  
  const unsubscribe = onSnapshot(accountRef, async (accountSnap) => {
    if (!accountSnap.exists()) {
      console.warn(`Account document ${accountId} does not exist.`);
      callback([]);
      return;
    }
    
    const memberIds = accountSnap.data()?.members as string[] || [];
    if (memberIds.length === 0) {
      callback([]);
      return;
    }

    try {
      const memberPromises = memberIds.map(id => getDoc(doc(db, 'users', id)));
      const memberDocSnaps = await Promise.all(memberPromises);
      
      const users = memberDocSnaps
        .filter(docSnap => docSnap.exists())
        .map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data
          } as UserAccount
        });
        
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

export async function fetchTeamMembers(accountId: string): Promise<UserAccount[]> {
  if (!accountId) return [];
  const accountRef = doc(db, 'accounts', accountId);
  const accountSnap = await getDoc(accountRef);
  if (!accountSnap.exists()) return [];

  const memberIds = accountSnap.data()?.members as string[] || [];
  if (memberIds.length === 0) return [];

  try {
    const memberPromises = memberIds.map(id => getDoc(doc(db, 'users', id)));
    const memberDocSnaps = await Promise.all(memberPromises);
    const users = memberDocSnaps
      .filter(docSnap => docSnap.exists())
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserAccount));
    return users.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching team members' documents:", error);
    return [];
  }
}
// #endregion
