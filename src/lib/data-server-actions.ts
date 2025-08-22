
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import type { CompletedRental, Client, Dumpster, Account, UserAccount } from './types';
import { adminDb } from './firebase-admin';

// Helper to convert Timestamps to serializable format
const toSerializableObject = (obj: any): any => {
    if (!obj) return obj;
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

export async function getAccount(accountId: string): Promise<Account | null> {
    try {
        const accountDoc = await adminDb.doc(`accounts/${accountId}`).get();
        if (!accountDoc.exists) {
            return null;
        }
        return docToSerializable(accountDoc) as Account;
    } catch(error) {
        console.error("Error fetching account data:", error);
        return null;
    }
}
