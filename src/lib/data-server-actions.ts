
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { CompletedRental, Client, Dumpster, Account, UserAccount, Backup, AdminClientView, PopulatedRental, Rental } from './types';
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


export async function getCompletedRentals(accountId: string): Promise<CompletedRental[]> {
    try {
        const rentalsCol = adminDb.collection(`accounts/${accountId}/completed_rentals`);
        const rentalsSnap = await rentalsCol.where('accountId', '==', accountId).get();
        
        if (rentalsSnap.empty) {
            return [];
        }

        const rentalPromises = rentalsSnap.docs.map(async (rentalDoc) => {
            const rentalData = toSerializableObject(rentalDoc.data());

            // Fetch client, dumpster, and user data in parallel
            const clientPromise = rentalData.clientId 
                ? adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get()
                : Promise.resolve(null);
            
            const dumpsterPromise = rentalData.dumpsterId
                ? adminDb.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get()
                : Promise.resolve(null);
            
            const assignedToPromise = rentalData.assignedTo
                ? adminDb.doc(`users/${rentalData.assignedTo}`).get()
                : Promise.resolve(null);

            const [clientSnap, dumpsterSnap, assignedToSnap] = await Promise.all([clientPromise, dumpsterPromise, assignedToPromise]);

            return {
                ...rentalData,
                id: rentalDoc.id,
                client: clientSnap ? docToSerializable(clientSnap) : null,
                dumpster: dumpsterSnap ? docToSerializable(dumpsterSnap) : null,
                assignedToUser: assignedToSnap ? docToSerializable(assignedToSnap) : null,
            } as CompletedRental;
        });

        let rentals = await Promise.all(rentalPromises);
        
        // Sort by completion date, most recent first
        return rentals.sort((a, b) => {
            const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
            const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
            return dateB - dateA;
        });

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
        const rentalRef = adminDb.doc(`accounts/${accountId}/rentals/${rentalId}`);
        const rentalDoc = await rentalRef.get();

        if (!rentalDoc.exists) {
            return null;
        }

        const rentalData = docToSerializable(rentalDoc) as Rental;

        // Fetch related documents
        const clientPromise = adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get();
        const dumpsterPromise = adminDb.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get();
        const assignedToPromise = adminDb.doc(`users/${rentalData.assignedTo}`).get();

        const [clientSnap, dumpsterSnap, assignedToSnap] = await Promise.all([clientPromise, dumpsterPromise, assignedToPromise]);

        return {
            ...rentalData,
            client: docToSerializable(clientSnap) as Client | null,
            dumpster: docToSerializable(dumpsterSnap) as Dumpster | null,
            assignedToUser: docToSerializable(assignedToSnap) as UserAccount | null,
        };
    } catch (error) {
        console.error(`Error fetching populated rental by ID ${rentalId}:`, error);
        return null;
    }
}
