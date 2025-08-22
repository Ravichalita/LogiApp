
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import type { CompletedRental, Client, Dumpster, Account, UserAccount } from './types';
import { adminDb } from './firebase-admin';

export async function getCompletedRentals(accountId: string): Promise<CompletedRental[]> {
    try {
        const rentalsCol = adminDb.collection(`accounts/${accountId}/completed_rentals`);
        const rentalsSnap = await rentalsCol.where('accountId', '==', accountId).get();
        
        if (rentalsSnap.empty) {
            return [];
        }

        const rentalPromises = rentalsSnap.docs.map(async (rentalDoc) => {
            const rentalData = rentalDoc.data();

            // Fetch client and dumpster data in parallel
            const clientPromise = rentalData.clientId 
                ? adminDb.doc(`accounts/${accountId}/clients/${rentalData.clientId}`).get()
                : Promise.resolve(null);
            
            const dumpsterPromise = rentalData.dumpsterId
                ? adminDb.doc(`accounts/${accountId}/dumpsters/${rentalData.dumpsterId}`).get()
                : Promise.resolve(null);

            const [clientSnap, dumpsterSnap] = await Promise.all([clientPromise, dumpsterPromise]);

            return {
                id: rentalDoc.id,
                ...rentalData,
                client: clientSnap?.exists ? { id: clientSnap.id, ...clientSnap.data() } as Client : null,
                dumpster: dumpsterSnap?.exists ? { id: dumpsterSnap.id, ...dumpsterSnap.data() } as Dumpster : null,
            } as CompletedRental;
        });

        const rentals = await Promise.all(rentalPromises);
        
        // Sort by completion date, most recent first
        return rentals.sort((a, b) => {
            const dateA = a.completedDate?.toDate ? a.completedDate.toDate() : new Date(0);
            const dateB = b.completedDate?.toDate ? b.completedDate.toDate() : new Date(0);
            return dateB.getTime() - dateA.getTime();
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
        return { id: accountDoc.id, ...accountDoc.data() } as Account;
    } catch(error) {
        console.error("Error fetching account data:", error);
        return null;
    }
}
