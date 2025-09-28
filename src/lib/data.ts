

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
  FieldPath,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase-client';
import type { Client, Dumpster, Rental, PopulatedRental, UserAccount, Account, Backup, Truck, Operation, PopulatedOperation, OperationType, CompletedRental, CompletedOperation } from './types';

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

export async function fetchAccount(accountId: string): Promise<Account | null> {
    const accountRef = doc(db, `accounts/${accountId}`);
    const docSnap = await getDoc(accountRef);
    if (docSnap.exists()) {
        return docToSerializable(docSnap) as Account;
    }
    return null;
}
// #endregion

// #region Client Data
export function getClients(accountId: string, callback: (clients: Client[]) => void): Unsubscribe {
  const clientsCollection = collection(db, `accounts/${accountId}/clients`);
  const q = query(clientsCollection, where("accountId", "==", accountId));
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const clients = querySnapshot.docs.map(doc => docToSerializable(doc) as Client);
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
    const clients = querySnapshot.docs.map(doc => docToSerializable(doc) as Client);
    return clients.sort((a, b) => a.name.localeCompare(b.name));
}

// #endregion


// #region Dumpster Data
export function getDumpsters(accountId: string, callback: (dumpsters: Dumpster[]) => void): Unsubscribe {
    const dumpstersCollection = collection(db, `accounts/${accountId}/dumpsters`);
    const q = query(dumpstersCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const dumpsters = querySnapshot.docs.map(doc => docToSerializable(doc) as Dumpster);
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
        const rentals = querySnapshot.docs.map(doc => docToSerializable(doc) as Rental);
        callback(rentals);
    }, (error) => {
        console.error("Error fetching rentals:", error);
        callback([]);
    });

    return unsubscribe;
}

export function getCompletedRentals(accountId: string, callback: (rentals: CompletedRental[]) => void): Unsubscribe {
    const rentalsCollection = collection(db, `accounts/${accountId}/completed_rentals`);
    const q = query(rentalsCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const rentals = querySnapshot.docs.map(doc => docToSerializable(doc) as CompletedRental);
        callback(rentals);
    }, (error) => {
        console.error("Error fetching completed rentals:", error);
        callback([]);
    });

    return unsubscribe;
}

export async function getActiveRentalsForUser(accountId: string, id: string, field: 'assignedTo' | 'clientId' = 'assignedTo'): Promise<Rental[]> {
    if (!accountId || !id) return [];
    const rentalsCollection = collection(db, `accounts/${accountId}/rentals`);
    const q = query(rentalsCollection, where(field, "==", id));
    const querySnapshot = await getDocs(q);
    const rentals = querySnapshot.docs.map(doc => docToSerializable(doc) as Rental);
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
            if (querySnapshot.empty) {
                onData([]);
                return;
            }

            const allDumpsterIds = new Set<string>();
            querySnapshot.docs.forEach(doc => {
                const data = doc.data() as Rental;
                if (data.dumpsterIds && Array.isArray(data.dumpsterIds)) {
                    data.dumpsterIds.forEach(id => allDumpsterIds.add(id));
                }
            });

            let dumpstersMap = new Map<string, Dumpster>();
            if (allDumpsterIds.size > 0) {
                const dumpsterQuery = query(collection(db, `accounts/${accountId}/dumpsters`), where(FieldPath.documentId(), 'in', Array.from(allDumpsterIds)));
                const dumpsterSnaps = await getDocs(dumpsterQuery);
                dumpsterSnaps.forEach(d => dumpstersMap.set(d.id, docToSerializable(d) as Dumpster));
            }


            const rentalPromises = querySnapshot.docs.map(async (rentalDoc) => {
                const rentalData = docToSerializable(rentalDoc) as Omit<Rental, 'id'>;

                const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rentalData.clientId));
                const assignedToPromise = getDoc(doc(db, `users`, rentalData.assignedTo));

                const [clientSnap, assignedToSnap] = await Promise.all([clientPromise, assignedToPromise]);

                const rentalDumpsters = rentalData.dumpsterIds?.map(id => dumpstersMap.get(id)).filter(Boolean) as Dumpster[] || [];

                return {
                    id: rentalDoc.id,
                    ...rentalData,
                    itemType: 'rental',
                    dumpsters: rentalDumpsters,
                    client: docToSerializable(clientSnap) as Client | null,
                    assignedToUser: docToSerializable(assignedToSnap) as UserAccount | null,
                };
            });

            const populatedRentals = await Promise.all(rentalPromises);
            onData(populatedRentals.filter(r => r.client && r.dumpsters && r.assignedToUser) as PopulatedRental[]);
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
export function getCompletedOperations(accountId: string, callback: (operations: CompletedOperation[]) => void): Unsubscribe {
  const opsCollection = collection(db, `accounts/${accountId}/completed_operations`);
  const q = query(opsCollection, where("accountId", "==", accountId));
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const ops = querySnapshot.docs.map(
        (doc) => docToSerializable(doc) as CompletedOperation
      );
      callback(ops);
    },
    (error) => {
      console.error("Error fetching completed operations:", error);
      callback([]);
    }
  );
  return unsubscribe;
}


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
                try {
                    const opData = docToSerializable(opDoc) as Omit<Operation, 'id'>;

                    // Ensure required fields exist before fetching related docs
                    if (!opData.clientId || !opData.driverId) {
                        console.warn(`Skipping operation ${opDoc.id} due to missing clientId or driverId.`);
                        return null; 
                    }

                    const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, opData.clientId));
                    const truckPromise = opData.truckId ? getDoc(doc(db, `accounts/${accountId}/trucks`, opData.truckId)) : Promise.resolve(null);
                    const driverPromise = getDoc(doc(db, `users`, opData.driverId));

                    const [clientSnap, truckSnap, driverSnap] = await Promise.all([clientPromise, truckPromise, driverPromise]);
                    
                    // If a required document (client, driver) doesn't exist, we skip this operation
                    if (!clientSnap.exists() || !driverSnap.exists()) {
                        console.warn(`Skipping operation ${opDoc.id} because a required related document (client or driver) was not found.`);
                        return null;
                    }

                    const serializedData = docToSerializable(opDoc) as Operation;
                    
                    const populatedTypes = (opData.typeIds || []).map(id => ({
                        id,
                        name: opTypeMap.get(id) || 'Tipo desconhecido'
                    }));

                    return {
                        ...serializedData,
                        itemType: 'operation',
                        client: docToSerializable(clientSnap) as Client | null,
                        truck: docToSerializable(truckSnap) as Truck | null,
                        driver: docToSerializable(driverSnap) as UserAccount | null,
                        operationTypes: populatedTypes,
                    };
                } catch (individualError) {
                     console.error(`Failed to process individual operation ${opDoc.id}:`, individualError);
                    return null; // Return null for the failed operation
                }
            });

            const populatedOpsResults = await Promise.all(opPromises);
            const validPopulatedOps = populatedOpsResults.filter((op): op is PopulatedOperation => op !== null);
            
            // Sort on the client side
            const sortedOps = validPopulatedOps
              .sort((a, b) => {
                // Handle potential undefined startDate by providing a fallback date.
                const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                return dateA - dateB; // Sort ascending by start time
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
        .map(docSnap => docToSerializable(docSnap) as UserAccount);
        
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
      .map(docSnap => docToSerializable(docSnap) as UserAccount);
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
    const trucks = querySnapshot.docs.map(doc => docToSerializable(doc) as Truck);
    callback(trucks.sort((a, b) => a.name.localeCompare(b.name)));
  }, (error) => {
    console.error("Error fetching trucks:", error);
    callback([]);
  });

  return unsubscribe;
}
// #endregion
