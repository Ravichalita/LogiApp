
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
  collectionGroup,
} from 'firebase/firestore';
import { getFirebase } from './firebase-client';
import type { Client, Dumpster, Rental, PopulatedRental, UserAccount, Account, Backup, Service, Truck, Operation } from './types';

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

// #region Truck Data
export function getTrucks(accountId: string, callback: (trucks: Truck[]) => void): Unsubscribe {
    const trucksCollection = collection(db, `accounts/${accountId}/trucks`);
    const q = query(trucksCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const trucks = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Truck));
        callback(trucks);
    }, (error) => {
        console.error("Error fetching trucks:", error);
        callback([]);
    });

    return unsubscribe;
}

export async function fetchTrucks(accountId: string): Promise<Truck[]> {
    const trucksCollection = collection(db, `accounts/${accountId}/trucks`);
    const q = query(trucksCollection, where("accountId", "==", accountId));
    const querySnapshot = await getDocs(q);
    const trucks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Truck));
    return trucks.sort((a, b) => a.model.localeCompare(b.model));
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
    const qRentals = query(rentalsCollection, where(field, "==", id));
    
    const operationsCollection = collection(db, `accounts/${accountId}/operations`);
    const qOperations = query(operationsCollection, where(field, "==", id));
    
    const [rentalsSnapshot, operationsSnapshot] = await Promise.all([
        getDocs(qRentals),
        getDocs(qOperations)
    ]);
    
    const rentals = rentalsSnapshot.docs.map(doc => doc.data() as Rental);
    const operations = operationsSnapshot.docs.map(doc => doc.data() as Rental);

    const combined = [...rentals, ...operations];

    return combined.map(data => ({
        ...data,
        id: data.id,
        rentalDate: data.rentalDate?.toDate ? data.rentalDate.toDate().toISOString() : data.rentalDate,
        returnDate: data.returnDate?.toDate ? data.returnDate.toDate().toISOString() : data.returnDate,
    }));
}


const populateOS = async (docSnap: DocumentData, accountId: string, servicesMap: Map<string, Service>): Promise<PopulatedRental> => {
    const osData = docSnap.data() as Rental; // Rental is a superset type

    const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, osData.clientId));
    const assignedToPromise = getDoc(doc(db, `users`, osData.assignedTo));
    
    let resourcePromise;
    if (osData.osType === 'rental' && osData.dumpsterId) {
        resourcePromise = getDoc(doc(db, `accounts/${accountId}/dumpsters`, osData.dumpsterId));
    } else if (osData.osType === 'operation' && osData.truckId) {
        resourcePromise = getDoc(doc(db, `accounts/${accountId}/trucks`, osData.truckId));
    } else {
        resourcePromise = Promise.resolve(null);
    }

    const [clientSnap, assignedToSnap, resourceSnap] = await Promise.all([clientPromise, assignedToPromise, resourcePromise]);

    const selectedServices = (osData.serviceIds || []).map(id => servicesMap.get(id)).filter(Boolean) as Service[];

    return {
        ...osData,
        id: docSnap.id,
        rentalDate: osData.rentalDate?.toDate ? osData.rentalDate.toDate().toISOString() : osData.rentalDate,
        returnDate: osData.returnDate?.toDate ? osData.returnDate.toDate().toISOString() : osData.returnDate,
        dumpster: osData.osType === 'rental' && resourceSnap?.exists() ? { id: resourceSnap.id, ...resourceSnap.data() } as Dumpster : null,
        truck: osData.osType === 'operation' && resourceSnap?.exists() ? { id: resourceSnap.id, ...resourceSnap.data() } as Truck : null,
        client: clientSnap.exists() ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
        assignedToUser: assignedToSnap.exists() ? { id: assignedToSnap.id, ...assignedToSnap.data() } as UserAccount : null,
        services: selectedServices,
    };
};


export function getPopulatedRentals(
    accountId: string, 
    onData: (rentals: PopulatedRental[]) => void,
    onError: (error: Error) => void,
    assignedToId?: string
): Unsubscribe {

    let rentalsQuery: Query<DocumentData> = query(collection(db, `accounts/${accountId}/rentals`), where("accountId", "==", accountId));
    let operationsQuery: Query<DocumentData> = query(collection(db, `accounts/${accountId}/operations`), where("accountId", "==", accountId));

    if (assignedToId) {
        rentalsQuery = query(rentalsQuery, where("assignedTo", "==", assignedToId));
        operationsQuery = query(operationsQuery, where("assignedTo", "==", assignedToId));
    }

    let combinedResults: PopulatedRental[] = [];
    let rentalsData: PopulatedRental[] = [];
    let operationsData: PopulatedRental[] = [];

    const updateCombinedResults = () => {
        const all = [...rentalsData, ...operationsData];
        // Deduplicate based on ID, just in case
        const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
        onData(unique);
    };

    const processSnapshot = async (snapshot: DocumentData, type: 'rental' | 'operation', servicesMap: Map<string, Service>) => {
        const promises = snapshot.docs.map((doc: DocumentData) => populateOS(doc, accountId, servicesMap));
        const populatedData = await Promise.all(promises);

        if (type === 'rental') {
            rentalsData = populatedData.filter(item => item !== null) as PopulatedRental[];
        } else {
            operationsData = populatedData.filter(item => item !== null) as PopulatedRental[];
        }
        updateCombinedResults();
    };

    let servicesMap: Map<string, Service> | null = null;
    
    // First, fetch the account to get the services list
    const accountUnsub = onSnapshot(doc(db, `accounts/${accountId}`), async (accountDoc) => {
        if (!accountDoc.exists()) {
            onError(new Error("Account not found"));
            return;
        }
        const allServices = (accountDoc.data()?.services || []) as Service[];
        servicesMap = new Map(allServices.map(s => [s.id, s]));

        // Once services are loaded, setup listeners for rentals and operations
        const rentalsUnsub = onSnapshot(rentalsQuery, (snap) => processSnapshot(snap, 'rental', servicesMap!), onError);
        const operationsUnsub = onSnapshot(operationsQuery, (snap) => processSnapshot(snap, 'operation', servicesMap!), onError);
        
        // This is complex. We return a function that unsubscribes from all listeners.
        // We're already inside the account listener, so it will be part of the teardown.
        userFacingUnsubscribe = () => {
            rentalsUnsub();
            operationsUnsub();
        };

    }, onError);

    let userFacingUnsubscribe = () => {
        accountUnsub();
        // The other unsubs will be attached here once the account loads
    };

    return () => {
        userFacingUnsubscribe();
    };
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
