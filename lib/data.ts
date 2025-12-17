
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
    documentId,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { Client, Dumpster, Rental, PopulatedRental, UserAccount, Account, Truck, Operation, PopulatedOperation, OperationType } from './types';

type Unsubscribe = () => void;

// #region Client Data
export function getClients(accountId: string, callback: (clients: Client[]) => void): Unsubscribe {
    const { db } = getFirebase();
    if (!db) {
        callback([]);
        return () => { };
    }
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
// #endregion

// Helper function to safely convert a Firestore document snapshot to a serializable object
const docToSerializable = (doc: DocumentData | null | undefined): any => {
    if (!doc || !doc.exists()) {
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
    return serializableData;
};

// #region Fleet Data
export function getTrucks(accountId: string, callback: (trucks: Truck[]) => void): Unsubscribe {
    const { db } = getFirebase();
    if (!db) {
        callback([]);
        return () => { };
    }
    const trucksCollection = collection(db, `accounts/${accountId}/trucks`);
    const q = query(trucksCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const trucks = querySnapshot.docs.map(doc => docToSerializable(doc) as Truck);
        const sortedTrucks = trucks.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedTrucks);
    }, (error) => {
        console.error("Error fetching trucks:", error);
        callback([]);
    });

    return unsubscribe;
}
// #endregion

// #region Dumpster Data
export function getDumpsters(accountId: string, callback: (dumpsters: Dumpster[]) => void): Unsubscribe {
    const { db } = getFirebase();
    if (!db) {
        callback([]);
        return () => { };
    }
    const dumpstersCollection = collection(db, `accounts/${accountId}/dumpsters`);
    const q = query(dumpstersCollection, where("accountId", "==", accountId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const dumpsters = querySnapshot.docs.map(doc => docToSerializable(doc) as Dumpster);
        const sortedDumpsters = dumpsters.sort((a, b) => {
            // Sort by size then name/id
            if (a.size !== b.size) return a.size - b.size;
            return a.name.localeCompare(b.name);
        });
        callback(sortedDumpsters);
    }, (error) => {
        console.error("Error fetching dumpsters:", error);
        callback([]);
    });

    return unsubscribe;
}
// #endregion

// #region Rental Data
export function getPopulatedRentals(
    accountId: string,
    onData: (rentals: PopulatedRental[]) => void,
    onError: (error: Error) => void,
    assignedToId?: string
): Unsubscribe {
    const { db } = getFirebase();
    if (!db) {
        onData([]);
        return () => { };
    }
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
                const data = doc.data();
                if (data.dumpsterIds && Array.isArray(data.dumpsterIds)) {
                    data.dumpsterIds.forEach((id: string) => allDumpsterIds.add(id));
                } else if (data.dumpsterId) { // Fallback for old data model
                    allDumpsterIds.add(data.dumpsterId);
                }
            });

            const dumpstersMap = new Map<string, Dumpster>();
            if (allDumpsterIds.size > 0) {
                // Firestore 'in' query is limited to 10 items. 
                // For simplicity in this port, we fetches all dumpsters if > 10 or optimize later.
                // Here we will fetch all dumpsters for the account to match IDs efficiently if list is large.
                // Or we can batch. For now let's use the 'in' query but split if needed? 
                // Actually, let's just fetch all dumpsters for the account to be safe and simple for now as per web implementation pattern logic
                // modifying slightly to just get all dumpsters for account to avoid 'in' limit issues if many dumpsters involved across rentals
                const dumpsterQuery = query(collection(db, `accounts/${accountId}/dumpsters`), where("accountId", "==", accountId));
                const dumpsterSnaps = await getDocs(dumpsterQuery);
                dumpsterSnaps.forEach(d => dumpstersMap.set(d.id, docToSerializable(d) as Dumpster));
            }


            const rentalPromises = querySnapshot.docs.map(async (rentalDoc) => {
                const rentalData = docToSerializable(rentalDoc) as Omit<Rental, 'id'> & { id: string };
                const anyRentalData = rentalData as any;

                const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, rentalData.clientId));
                const assignedToPromise = getDoc(doc(db, `users`, rentalData.assignedTo));
                const truckPromise = rentalData.truckId ? getDoc(doc(db, `accounts/${accountId}/trucks`, rentalData.truckId)) : Promise.resolve(null);

                const dumpsterIds: string[] = rentalData.dumpsterIds || (anyRentalData.dumpsterId ? [anyRentalData.dumpsterId] : []);

                const [clientSnap, assignedToSnap, truckSnap] = await Promise.all([clientPromise, assignedToPromise, truckPromise]);

                const rentalDumpsters = dumpsterIds
                    .map(id => dumpstersMap.get(id))
                    .filter(Boolean) as Dumpster[];

                return {
                    ...rentalData,
                    itemType: 'rental',
                    dumpsters: rentalDumpsters,
                    client: docToSerializable(clientSnap) as Client | null,
                    assignedToUser: docToSerializable(assignedToSnap) as UserAccount | null,
                    truck: docToSerializable(truckSnap) as Truck | null,
                };
            });

            const populatedRentals = await Promise.all(rentalPromises);
            // Type assertion needed because of differences in exact typing vs web
            const validRentals = populatedRentals.filter(r => r.client && r.dumpsters && r.dumpsters.length > 0 && r.assignedToUser) as any[];
            onData(validRentals);
        } catch (e) {
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
    const { db } = getFirebase();
    if (!db) {
        onData([]);
        return () => { };
    }
    const opsCollection = collection(db, `accounts/${accountId}/operations`);
    let q: Query<DocumentData> = query(opsCollection, where("accountId", "==", accountId));

    if (driverId) {
        q = query(q, where("driverId", "==", driverId));
    }

    const accountRef = doc(db, `accounts/${accountId}`);

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        try {
            const accountSnap = await getDoc(accountRef);
            const operationTypes: OperationType[] = accountSnap.exists() ? (accountSnap.data()?.operationTypes || []) : [];
            const opTypeMap = new Map(operationTypes.map(t => [t.id, t.name]));

            const opPromises = querySnapshot.docs.map(async (opDoc) => {
                try {
                    const opData = docToSerializable(opDoc) as Omit<Operation, 'id'>;

                    if (!opData.clientId || !opData.driverId) {
                        return null;
                    }

                    const clientPromise = getDoc(doc(db, `accounts/${accountId}/clients`, opData.clientId));
                    const truckPromise = opData.truckId ? getDoc(doc(db, `accounts/${accountId}/trucks`, opData.truckId)) : Promise.resolve(null);
                    const driverPromise = getDoc(doc(db, `users`, opData.driverId));

                    const [clientSnap, truckSnap, driverSnap] = await Promise.all([clientPromise, truckPromise, driverPromise]);

                    if (!clientSnap.exists() || !driverSnap.exists()) {
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
                    return null;
                }
            });

            const populatedOpsResults = await Promise.all(opPromises);
            const validPopulatedOps = populatedOpsResults.filter((op): op is PopulatedOperation => op !== null);

            const sortedOps = validPopulatedOps
                .sort((a, b) => {
                    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                    return dateA - dateB;
                });

            onData(sortedOps);
        } catch (e) {
            console.error("Error processing populated operations:", e)
            if (e instanceof Error) {
                onError(e);
            }
        }
    }, (error: any) => {
        onError(error);
    });

    return unsubscribe;
}
// #endregion

// #region Account/Team
export async function getAccount(accountId: string): Promise<Account | null> {
    const { db } = getFirebase();
    if (!db) return null;
    const accountRef = doc(db, `accounts/${accountId}`);
    const docSnap = await getDoc(accountRef);
    if (docSnap.exists()) {
        return docToSerializable(docSnap) as Account;
    }
    return null;
}
// #endregion
