
'use client';

import {
  collection,
  query,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  where,
  Query,
  DocumentData,
  orderBy,
} from 'firebase/firestore';
import { getFirebase } from './firebase-client';
import type { Client, Dumpster, Rental, PopulatedRental, UserAccount, Account, Backup, Truck, Operation, PopulatedOperation, OperationType } from './types';

type Unsubscribe = () => void;

const { db } = getFirebase();

// Helper function to safely convert a Firestore document snapshot to a serializable object
const docToSerializable = (doc: DocumentData): any => {
  if (!doc.exists()) {
    return null;
  }
  const data = doc.data();
  const serializableData: { [key: string]: any } = { id: doc.id };

  for (const key in data) {
    const value = data[key];
    if (value && typeof value.toDate === 'function') {
      serializableData[key] = value.toDate().toISOString();
    } else {
      serializableData[key] = value;
    }
  }
  return serializableData;
};

// #region Account Data
export function getAccount(accountId: string, callback: (account: Account | null) => void): Unsubscribe {
    const accountRef = doc(db, `accounts/${accountId}`);
    const unsubscribe = onSnapshot(accountRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docToSerializable(docSnap) as Account);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Error fetching account:", error);
        callback(null);
    });
    return unsubscribe;
}
// #endregion

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

export async function getActiveRentalsForUser(accountId: string, id: string, field: 'assignedTo' | 'clientId' = 'assignedTo'): Promise<Rental[]> {
    if (!accountId || !id) return [];
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, where(field, "==", id));
    const querySnapshot = await getDocs(q);
    const rentals = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            rentalDate: data.rentalDate?.toDate ? data.rentalDate.toDate().toISOString() : data.rentalDate,
            returnDate: data.returnDate?.toDate ? data.returnDate.toDate().toISOString() : data.returnDate,
        } as Rental;
    });
    return rentals;
}

export function getPopulatedRentals(
    accountId: string, 
    onData: (rentals: PopulatedRental[]) => void,
    onError: (error: Error) => void,
    assignedToId?: string
): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    
    let q: Query<DocumentData> = query(rentalsCollection, where("accountId", "==", accountId));
    
    if (assignedToId) {
        q = query(q, where("assignedTo", "==", assignedToId));
    }

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        try {
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
            onData(populatedRentals.filter(r => r.client && r.dumpster && r.assignedToUser));
        } catch(e) {
            console.error("Error processing populated rentals:", e)
            if (e instanceof Error) {
               onError(e);
            }
        }
    }, (error) => {
        onError(error);
    });

    return unsubscribe;
}
// #endregion

// #region Operation Data
export function getPopulatedOperations(
    accountId: string,
    onData: (operations: PopulatedOperation[]) => void,
    onError: (error: Error) => void,
    driverId?: string,
): Unsubscribe {
    const opsCollection = collection(db, `accounts/${accountId}/operations`);
    let q: Query<DocumentData> = query(opsCollection, where("accountId", "==", accountId));

    if (driverId) {
        q = query(q, where("driverId", "==", driverId));
    }
    
    // We also need account data to get operation type names
    const accountRef = doc(db, `accounts/${accountId}`);

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        try {
            const accountSnap = await getDoc(accountRef);
            const operationTypes: OperationType[] = accountSnap.exists() ? (accountSnap.data()?.operationTypes || []) : [];
            const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));

            const opPromises = querySnapshot.docs.map(async (opDoc) => {
                const opData = opDoc.data() as Omit<Operation, 'id'>;

                const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, opData.clientId));
                const truckPromise = opData.truckId ? getDoc(doc(db, `accounts/${accountId}/trucks`, opData.truckId)) : Promise.resolve(null);
                const driverPromise = opData.driverId ? getDoc(doc(db, `users`, opData.driverId)) : Promise.resolve(null);

                const [clientSnap, truckSnap, driverSnap] = await Promise.all([clientPromise, truckPromise, driverPromise]);

                const serializedData = docToSerializable(opDoc) as Operation;
                const operationTypeName = opTypeMap.get(opData.type) || opData.type;

                return {
                    ...serializedData,
                    client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
                    truck: truckSnap?.exists() ? { id: truckSnap.id, ...truckSnap.data() } as Truck : null,
                    driver: driverSnap?.exists() ? { id: driverSnap.id, ...driverSnap.data() } as UserAccount : null,
                    operationTypeName,
                };
            });

            const populatedOps = await Promise.all(opPromises);
            
            // Sort on the client side
            const sortedOps = populatedOps
              .filter((op): op is PopulatedOperation => !!op.client)
              .sort((a, b) => {
                // Handle potential undefined createdAt by providing a fallback date.
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA; // Sort descending
            });

            onData(sortedOps);
        } catch(e) {
            console.error("Error processing populated operations:", e)
            if (e instanceof Error) {
               onError(e);
            }
        }
    }, (error) => {
        onError(error);
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

// #region Fleet Data
export function getTrucks(accountId: string, callback: (trucks: Truck[]) => void): Unsubscribe {
  const trucksCollection = collection(db, `accounts/${accountId}/trucks`);
  const q = query(trucksCollection, where("accountId", "==", accountId));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const trucks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Truck));
    callback(trucks.sort((a, b) => a.name.localeCompare(b.name)));
  }, (error) => {
    console.error("Error fetching trucks:", error);
    callback([]);
  });

  return unsubscribe;
}
// #endregion
