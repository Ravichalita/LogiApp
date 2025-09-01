

'use server';

import { getFirestore, Timestamp, onSnapshot } from 'firebase-admin/firestore';
import type { CompletedRental, Client, Dumpster, Account, UserAccount, Backup, AdminClientView, PopulatedRental, Rental, DirectionsResponse, Truck } from './types';
import { adminDb } from './firebase-admin';

// Helper to convert Timestamps to serializable format
const toSerializableObject = (obj: any): any => {
    if (obj == null) return obj;
    if (typeof obj !== 'object') return obj;

    if (obj.toDate && typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }
    
    if (Array.isArray(obj)) {
        return obj.map(toSerializableObject);
    }
    
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = toSerializableObject(obj[key]);
        }
    }
    return newObj;
}

// Helper function to safely convert a Firestore document snapshot to a serializable object
const docToSerializable = (doc: FirebaseFirestore.DocumentSnapshot): any => {
  if (!doc.exists) {
    return null;
  }
  return toSerializableObject({ id: doc.id, ...doc.data() });
};

// Helper function for error handling
function handleFirebaseError(error: unknown): string {
  let message = 'Ocorreu um erro desconhecido.';
  if (error instanceof Error) {
    message = error.message;
  }
  return message;
}


export async function getCompletedRentals(accountId: string): Promise<CompletedRental[]> {
    try {
        const rentalsCol = adminDb.collection(`accounts/${accountId}/completed_rentals`);
        const rentalsSnap = await rentalsCol.orderBy('completedDate', 'desc').get();
        
        if (rentalsSnap.empty) {
            return [];
        }

        const rentals = rentalsSnap.docs.map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as CompletedRental);
        
        return rentals;

    } catch (error) {
        console.error("Error fetching completed rentals:", error);
        return [];
    }
}


export async function getBackupsAction(accountId: string): Promise<Backup[]> {
    if (!accountId) {
        console.error("getBackupsAction called without accountId");
        return [];
    }
    try {
        const backupsCollection = adminDb.collection('backups');
        const q = backupsCollection.where('accountId', '==', accountId);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            return [];
        }
        
        const backups = querySnapshot.docs.map(doc => toSerializableObject({ id: doc.id, ...doc.data() }) as Backup);

        // Sort on the server before returning
        return backups.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
    } catch (error) {
        console.error("Error fetching backups via server action:", error);
        // In case of error, return an empty array to the client instead of throwing
        return [];
    }
}

export async function getAllClientAccountsAction(superAdminId: string): Promise<AdminClientView[]> {
    try {
        const accountsCollection = adminDb.collection('accounts');
        const accountsSnap = await accountsCollection.get();
        
        if (accountsSnap.empty) {
            return [];
        }

        const clientViewPromises = accountsSnap.docs.map(async (accountDoc) => {
            const accountData = toSerializableObject(accountDoc.data());
            const ownerId = accountData.ownerId;
            
            if (!ownerId || ownerId === superAdminId) return null;

            const ownerSnap = await adminDb.doc(`users/${ownerId}`).get();
            if (!ownerSnap.exists) return null;

            const ownerData = toSerializableObject(ownerSnap.data());

            // Fetch all members
            const memberIds = accountData.members || [];
            let members: UserAccount[] = [];
            if (memberIds.length > 0) {
                const memberPromises = memberIds.map((id: string) => adminDb.doc(`users/${id}`).get());
                const memberDocs = await Promise.all(memberPromises);
                members = memberDocs
                    .filter(doc => doc.exists)
                    .map(doc => docToSerializable(doc) as UserAccount);
            }

            return {
                accountId: accountDoc.id,
                ownerId: ownerId,
                ownerName: ownerData.name,
                ownerEmail: ownerData.email,
                ownerStatus: ownerData.status ?? 'ativo',
                createdAt: ownerData.createdAt,
                members: members,
            };
        });

        const results = await Promise.all(clientViewPromises);
        const validResults = results.filter((r): r is AdminClientView => r !== null);
        
        return validResults.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error("Error fetching all client accounts:", error);
        return [];
    }
}

export async function getPopulatedRentalById(accountId: string, rentalId: string): Promise<PopulatedRental | null> {
    try {
        // Determine if it's a rental or operation to check the correct collection
        const isRental = rentalId.startsWith('AL-');
        const collectionName = isRental ? 'rentals' : 'operations';
        
        const rentalRef = adminDb.doc(`accounts/${accountId}/${collectionName}/${rentalId}`);
        const rentalDoc = await rentalRef.get();

        if (!rentalDoc.exists) {
            return null;
        }

        const rentalData = docToSerializable(rentalDoc) as Rental;

        // Fetch related documents
        const clientPromise = adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
        const dumpsterPromise = rentalData.dumpsterId ? adminDb.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get() : Promise.resolve(null);
        const truckPromise = rentalData.truckId ? adminDb.doc(`accounts/${accountId}/trucks/${rentalData.truckId}`).get() : Promise.resolve(null);
        const assignedToPromise = adminDb.doc(`users/${rentalData.assignedTo}`).get();
        const accountPromise = adminDb.doc(`accounts/${accountId}`).get();

        const [clientSnap, dumpsterSnap, truckSnap, assignedToSnap, accountSnap] = await Promise.all([clientPromise, dumpsterPromise, truckPromise, assignedToPromise, accountPromise]);

        const allServices = (accountSnap.data()?.services || []) as any[];
        const servicesMap = new Map(allServices.map(s => [s.id, s]));
        const selectedServices = (rentalData.serviceIds || []).map(id => servicesMap.get(id)).filter(Boolean);

        return {
            ...rentalData,
            client: docToSerializable(clientSnap) as Client | null,
            dumpster: docToSerializable(dumpsterSnap) as Dumpster | null,
            truck: docToSerializable(truckSnap) as Truck | null,
            assignedToUser: docToSerializable(assignedToSnap) as UserAccount | null,
            services: selectedServices,
        };
    } catch (error) {
        console.error(`Error fetching populated rental by ID ${rentalId}:`, error);
        return null;
    }
}

export async function getDirectionsAction(origin: {lat: number, lng: number}, destination: {lat: number, lng: number}): Promise<DirectionsResponse | { error: string }> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return { error: 'A chave da API do Google Maps não está configurada.' };
    }

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.append('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.append('key', apiKey);
    
    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.status !== 'OK') {
            return { error: `Erro da API do Google: ${data.status} - ${data.error_message || ''}` };
        }

        const route = data.routes[0];
        if (!route || !route.legs[0]) {
            return { error: 'Nenhuma rota encontrada.' };
        }
        
        const leg = route.legs[0];
        
        return {
            distance: leg.distance, // { text: '...', value: '...' (meters)}
            duration: leg.duration, // { text: '...', value: '...' (seconds)}
        };
    } catch (error) {
        return { error: handleFirebaseError(error) };
    }
}
