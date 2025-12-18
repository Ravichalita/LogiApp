import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp,
    increment,
    runTransaction,
} from 'firebase/firestore';
import { getFirebase } from './firebase';

import type { Client, Dumpster, Rental, Operation, Truck, UserAccount, Attachment, RecurrenceData, AdditionalCost } from './types';

// Helper to handle common errors
const handleFirebaseError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Ocorreu um erro inesperado.';
};

// #region Rental Actions

export interface CreateRentalData {
    dumpsterIds: string[];
    clientId: string;
    assignedTo: string;
    truckId?: string;
    rentalDate: string;
    returnDate: string;
    deliveryAddress: string;
    latitude?: number;
    longitude?: number;
    value: number;
    billingType: 'perDay' | 'lumpSum';
    lumpSumValue?: number;
    observations?: string;
    startAddress?: string;
    startLatitude?: number;
    startLongitude?: number;
    attachments?: Attachment[];
    additionalCosts?: AdditionalCost[];
    travelCost?: number;
    recurrence?: RecurrenceData;
}

export async function createRentalAction(
    accountId: string,
    createdBy: string,
    data: CreateRentalData
): Promise<{ success: boolean; error?: string; rentalId?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        // Get sequential ID using transaction
        const accountRef = doc(db, 'accounts', accountId);

        const rentalId = await runTransaction(db, async (transaction) => {
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists()) {
                throw new Error('Conta não encontrada.');
            }

            const currentCounter = accountSnap.data()?.rentalCounter || 0;
            const newCounter = currentCounter + 1;

            // Update counter
            transaction.update(accountRef, { rentalCounter: newCounter });

            // Create rental document
            const rentalRef = doc(collection(db, `accounts/${accountId}/rentals`));

            // Create Recurrence Profile if needed
            let recurrenceProfileId = null;
            if (data.recurrence && data.recurrence.enabled) {
                const recurrenceRef = doc(collection(db, `accounts/${accountId}/recurrence_profiles`));
                recurrenceProfileId = recurrenceRef.id;
                transaction.set(recurrenceRef, {
                    ...data.recurrence,
                    originalOrderId: rentalRef.id,
                    createdAt: serverTimestamp(),
                    status: 'active',
                    type: 'rental',
                });
            }

            const rentalData: any = {
                sequentialId: newCounter,
                dumpsterIds: data.dumpsterIds,
                clientId: data.clientId,
                assignedTo: data.assignedTo,
                truckId: data.truckId || null,
                rentalDate: data.rentalDate,
                returnDate: data.returnDate,
                deliveryAddress: data.deliveryAddress,
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                value: data.value,
                billingType: data.billingType,
                lumpSumValue: data.lumpSumValue || 0,
                observations: data.observations || '',
                startAddress: data.startAddress || '',
                startLatitude: data.startLatitude || null,
                startLongitude: data.startLongitude || null,
                status: 'Pendente',
                createdBy: createdBy,
                accountId: accountId,
                createdAt: serverTimestamp(),
                notificationsSent: { due: false, late: false },
                attachments: data.attachments || [],
                additionalCosts: data.additionalCosts || [],
                travelCost: data.travelCost || 0,
                recurrenceProfileId: recurrenceProfileId,
            };

            transaction.set(rentalRef, rentalData);

            return rentalRef.id;
        });

        return { success: true, rentalId };
    } catch (error) {
        console.error('Error creating rental:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function updateRentalStatusAction(
    accountId: string,
    rentalId: string,
    newStatus: 'Pendente' | 'Ativo' | 'Finalizado' | 'Atrasado'
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const rentalRef = doc(db, `accounts/${accountId}/rentals`, rentalId);
        await updateDoc(rentalRef, { status: newStatus });

        return { success: true };
    } catch (error) {
        console.error('Error updating rental status:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function startRentalAction(
    accountId: string,
    rentalId: string
): Promise<{ success: boolean; error?: string }> {
    return updateRentalStatusAction(accountId, rentalId, 'Ativo');
}

export async function finishRentalAction(
    accountId: string,
    rentalId: string
): Promise<{ success: boolean; error?: string }> {
    // For now, just update status. Full implementation would move to completed_rentals
    return updateRentalStatusAction(accountId, rentalId, 'Finalizado');
}

export interface UpdateRentalData {
    dumpsterIds?: string[];
    clientId?: string;
    assignedTo?: string;
    truckId?: string;
    rentalDate?: string;
    returnDate?: string;
    deliveryAddress?: string;
    value?: number;
    observations?: string;
    attachments?: Attachment[];
}

export async function updateRentalAction(
    accountId: string,
    rentalId: string,
    data: UpdateRentalData
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const rentalRef = doc(db, `accounts/${accountId}/rentals`, rentalId);

        const updateData: any = { ...data };
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await updateDoc(rentalRef, updateData);

        return { success: true };
    } catch (error) {
        console.error('Error updating rental:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function deleteRentalAction(
    accountId: string,
    rentalId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const rentalRef = doc(db, `accounts/${accountId}/rentals`, rentalId);
        await deleteDoc(rentalRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting rental:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

// #endregion

// #region Operation Actions

export interface CreateOperationData {
    typeIds: string[];
    clientId: string;
    driverId: string;
    truckId?: string;
    startDate: string;
    endDate: string;
    startAddress: string;
    startLatitude?: number;
    startLongitude?: number;
    destinationAddress: string;
    destinationLatitude?: number;
    destinationLongitude?: number;
    value: number;
    observations?: string;
    attachments?: Attachment[];
    additionalCosts?: AdditionalCost[];
    travelCost?: number;
    recurrence?: RecurrenceData;
}

export async function createOperationAction(
    accountId: string,
    createdBy: string,
    data: CreateOperationData
): Promise<{ success: boolean; error?: string; operationId?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const accountRef = doc(db, 'accounts', accountId);

        const operationId = await runTransaction(db, async (transaction) => {
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists()) {
                throw new Error('Conta não encontrada.');
            }

            const currentCounter = accountSnap.data()?.operationCounter || 0;
            const newCounter = currentCounter + 1;

            transaction.update(accountRef, { operationCounter: newCounter });

            const operationRef = doc(collection(db, `accounts/${accountId}/operations`));

            // Create Recurrence Profile if needed
            let recurrenceProfileId = null;
            if (data.recurrence && data.recurrence.enabled) {
                const recurrenceRef = doc(collection(db, `accounts/${accountId}/recurrence_profiles`));
                recurrenceProfileId = recurrenceRef.id;
                transaction.set(recurrenceRef, {
                    ...data.recurrence,
                    originalOrderId: operationRef.id,
                    createdAt: serverTimestamp(),
                    status: 'active',
                    type: 'operation',
                });
            }

            const operationData: any = {
                sequentialId: newCounter,
                typeIds: data.typeIds,
                clientId: data.clientId,
                driverId: data.driverId,
                truckId: data.truckId || null,
                startDate: data.startDate,
                endDate: data.endDate,
                startAddress: data.startAddress,
                startLatitude: data.startLatitude || null,
                startLongitude: data.startLongitude || null,
                destinationAddress: data.destinationAddress,
                destinationLatitude: data.destinationLatitude || null,
                destinationLongitude: data.destinationLongitude || null,
                value: data.value || 0,
                observations: data.observations || '',
                status: 'Pendente',
                createdBy: createdBy,
                accountId: accountId,
                createdAt: serverTimestamp(),
                attachments: data.attachments || [],
                additionalCosts: data.additionalCosts || [],
                travelCost: data.travelCost || 0,
                recurrenceProfileId: recurrenceProfileId,
            };

            transaction.set(operationRef, operationData);

            return operationRef.id;
        });

        return { success: true, operationId };
    } catch (error) {
        console.error('Error creating operation:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function updateOperationStatusAction(
    accountId: string,
    operationId: string,
    newStatus: 'Pendente' | 'Em Andamento' | 'Concluído'
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const operationRef = doc(db, `accounts/${accountId}/operations`, operationId);
        await updateDoc(operationRef, { status: newStatus });

        return { success: true };
    } catch (error) {
        console.error('Error updating operation status:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function startOperationAction(
    accountId: string,
    operationId: string
): Promise<{ success: boolean; error?: string }> {
    return updateOperationStatusAction(accountId, operationId, 'Em Andamento');
}

export async function finishOperationAction(
    accountId: string,
    operationId: string
): Promise<{ success: boolean; error?: string }> {
    return updateOperationStatusAction(accountId, operationId, 'Concluído');
}

export interface UpdateOperationData {
    typeIds?: string[];
    clientId?: string;
    driverId?: string;
    truckId?: string;
    startDate?: string;
    endDate?: string;
    startAddress?: string;
    destinationAddress?: string;
    value?: number;
    observations?: string;
    attachments?: Attachment[];
}

export async function updateOperationAction(
    accountId: string,
    operationId: string,
    data: UpdateOperationData
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const operationRef = doc(db, `accounts/${accountId}/operations`, operationId);

        const updateData: any = { ...data };
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await updateDoc(operationRef, updateData);

        return { success: true };
    } catch (error) {
        console.error('Error updating operation:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function deleteOperationAction(
    accountId: string,
    operationId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const operationRef = doc(db, `accounts/${accountId}/operations`, operationId);
        await deleteDoc(operationRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting operation:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

// #endregion

// #region Client Actions

export interface CreateClientData {
    name: string;
    phone: string;
    address?: string;
    email?: string;
    cpfCnpj?: string;
    latitude?: number;
    longitude?: number;
    observations?: string;
}

export async function createClientAction(
    accountId: string,
    data: CreateClientData
): Promise<{ success: boolean; error?: string; clientId?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const clientRef = await addDoc(collection(db, `accounts/${accountId}/clients`), {
            ...data,
            accountId,
            createdAt: serverTimestamp(),
        });

        return { success: true, clientId: clientRef.id };
    } catch (error) {
        console.error('Error creating client:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export interface UpdateClientData {
    name?: string;
    phone?: string;
    address?: string;
    email?: string;
    cpfCnpj?: string;
    latitude?: number;
    longitude?: number;
    observations?: string;
}

export async function updateClientAction(
    accountId: string,
    clientId: string,
    data: UpdateClientData
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const clientRef = doc(db, `accounts/${accountId}/clients`, clientId);

        const updateData: any = { ...data };
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await updateDoc(clientRef, updateData);

        return { success: true };
    } catch (error) {
        console.error('Error updating client:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

export async function deleteClientAction(
    accountId: string,
    clientId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const clientRef = doc(db, `accounts/${accountId}/clients`, clientId);
        await deleteDoc(clientRef);

        return { success: true };
    } catch (error) {
        console.error('Error deleting client:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

// #endregion

// #region Recurrence Actions

export async function cancelRecurrenceAction(
    accountId: string,
    recurrenceProfileId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        const recurrenceRef = doc(db, `accounts/${accountId}/recurrence_profiles`, recurrenceProfileId);
        await updateDoc(recurrenceRef, { status: 'cancelled' });

        return { success: true };
    } catch (error) {
        console.error('Error cancelling recurrence:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

// #endregion

// #region User Actions

export interface UpdateUserData {
    name?: string;
    phone?: string;
}

export async function updateUserAction(
    uid: string,
    accountId: string,
    data: UpdateUserData
): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = getFirebase();
        if (!db) throw new Error('Firebase not initialized');

        // Update in global users collection
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { ...data });

        // Update in account team collection (denormalized)
        const teamMemberRef = doc(db, `accounts/${accountId}/team`, uid);
        // We check if it exists first to avoid errors if for some reason data is out of sync
        const teamMemberSnap = await getDoc(teamMemberRef);
        if (teamMemberSnap.exists()) {
            await updateDoc(teamMemberRef, { ...data });
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, error: handleFirebaseError(error) };
    }
}

// #endregion
