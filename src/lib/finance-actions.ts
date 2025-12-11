'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
    TransactionCategorySchema,
    TransactionSchema,
    UpdateTransactionSchema,
    AccountSchema,
    RecurringTransactionProfileSchema
} from './types';
import type {
    Transaction,
    TransactionCategory,
    Account,
    RecurringTransactionProfile,
    CompletedRental,
    PopulatedOperation
} from './types';
import { generateTransactionsForProfile } from './recurring-utils';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

// #region Helper Functions

function handleFirebaseError(error: unknown): string {
    let message = 'Ocorreu um erro desconhecido.';
    if (error instanceof Error) {
        message = error.message;
    }
    return message;
}

function parseFirestoreDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue instanceof Timestamp) {
        return dateValue.toDate();
    }
    // Duck typing for Timestamp-like objects in case of version mismatch or similar
    if (typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }
    if (dateValue instanceof Date) {
        return dateValue;
    }
    if (typeof dateValue === 'string') {
        return parseISO(dateValue);
    }
    return new Date(dateValue);
}

// #endregion

// #region Categories Actions

export async function createCategoryAction(accountId: string, category: Omit<TransactionCategory, 'id'>) {
    if (!accountId) return { message: 'error', error: 'ID da conta ausente.' };

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const newCategory: TransactionCategory = {
            id: adminDb.collection('dummy').doc().id, // Generate random ID
            ...category
        };

        await accountRef.update({
            financialCategories: FieldValue.arrayUnion(newCategory)
        });

        revalidatePath('/finance');
        return { message: 'success', category: newCategory };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateCategoryAction(accountId: string, category: TransactionCategory) {
    if (!accountId) return { message: 'error', error: 'ID da conta ausente.' };

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) throw new Error("Conta não encontrada.");

        const accountData = accountSnap.data() as Account;
        const currentCategories = accountData.financialCategories || [];

        const updatedCategories = currentCategories.map(c => c.id === category.id ? category : c);

        await accountRef.update({
            financialCategories: updatedCategories
        });

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteCategoryAction(accountId: string, categoryId: string) {
    if (!accountId) return { message: 'error', error: 'ID da conta ausente.' };

    try {
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) throw new Error("Conta não encontrada.");

        const accountData = accountSnap.data() as Account;
        const currentCategories = accountData.financialCategories || [];

        const updatedCategories = currentCategories.filter(c => c.id !== categoryId);

        await accountRef.update({
            financialCategories: updatedCategories
        });

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

// #endregion

// #region Recurring Transaction Actions

export async function saveRecurringTransactionProfileAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    // Parse daysOfWeek manually since it comes as individual checkboxes or not at all
    // We expect the form to send `daysOfWeek` as a JSON string or we handle checkbox convention
    // Let's assume the client sends a JSON string for complex arrays to simplify
    let daysOfWeek: number[] = [];
    if (rawData.daysOfWeek && typeof rawData.daysOfWeek === 'string') {
        try {
            daysOfWeek = JSON.parse(rawData.daysOfWeek);
        } catch (e) {
            console.error("Failed to parse daysOfWeek", e);
        }
    }

    const dataToValidate = {
        ...rawData,
        amount: Number(rawData.amount),
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
        accountId
    };

    const validated = RecurringTransactionProfileSchema.safeParse(dataToValidate);

    if (!validated.success) {
        return {
            message: 'error',
            error: JSON.stringify(validated.error.flatten().fieldErrors)
        };
    }

    // Sanitize profile to remove undefined values (Firestore limitation)
    const profile = JSON.parse(JSON.stringify(validated.data));
    const accountRef = adminDb.doc(`accounts/${accountId}`);

    try {
        // 1. Update Profile in Account
        await adminDb.runTransaction(async (t) => {
            const accountSnap = await t.get(accountRef);
            if (!accountSnap.exists) throw new Error("Conta não encontrada.");

            const accountData = accountSnap.data() as Account;
            let profiles = accountData.recurringTransactionProfiles || [];

            const existingIndex = profiles.findIndex(p => p.id === profile.id);
            if (existingIndex >= 0) {
                profiles[existingIndex] = profile;
            } else {
                profiles.push(profile);
            }

            t.update(accountRef, { recurringTransactionProfiles: profiles });
        });

        // 2. Cleanup Old Future Transactions (Batched)
        // We do this AFTER updating profile to ensure consistency eventually,
        // though technically there is a small race condition window.
        // Given the 500 limit, splitting is safer.

        const transactionsRef = adminDb.collection(`accounts/${accountId}/transactions`);

        // Find future pending transactions for this profile
        // NOTE: We only query by profile and status to avoid composite index requirement.
        // We filter by date in memory.
        const cleanupQuery = transactionsRef
            .where('recurringProfileId', '==', profile.id)
            .where('status', '==', 'pending');

        const cleanupSnap = await cleanupQuery.get();

        // Filter in memory for future dates
        const docsToDelete = cleanupSnap.docs.filter(doc => {
            const data = doc.data() as Transaction;
            return new Date(data.dueDate) > new Date();
        });

        // Batch Delete
        const batchSize = 400; // Safety margin

        for (let i = 0; i < docsToDelete.length; i += batchSize) {
            const batch = adminDb.batch();
            docsToDelete.slice(i, i + batchSize).forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        // 3. Generate New Transactions (Batched)
        const newTransactions = generateTransactionsForProfile(profile, accountId);
        const futureTransactions = newTransactions.filter(tr => new Date(tr.dueDate) > new Date());

        for (let i = 0; i < futureTransactions.length; i += batchSize) {
            const batch = adminDb.batch();
            futureTransactions.slice(i, i + batchSize).forEach(tr => {
                const newDocRef = transactionsRef.doc();
                batch.set(newDocRef, tr);
            });
            await batch.commit();
        }

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteRecurringTransactionProfileAction(accountId: string, profileId: string) {
    if (!accountId || !profileId) return { message: 'error', error: 'IDs ausentes.' };

    const accountRef = adminDb.doc(`accounts/${accountId}`);

    try {
        // 1. Update Account Profile
        await adminDb.runTransaction(async (t) => {
            const accountSnap = await t.get(accountRef);
            if (!accountSnap.exists) throw new Error("Conta não encontrada.");

            const accountData = accountSnap.data() as Account;
            const profiles = accountData.recurringTransactionProfiles || [];

            const newProfiles = profiles.filter(p => p.id !== profileId);

            if (newProfiles.length === profiles.length) return;

            t.update(accountRef, { recurringTransactionProfiles: newProfiles });
        });

        // 2. Delete Future Transactions (Batched)
        const transactionsRef = adminDb.collection(`accounts/${accountId}/transactions`);
        // Avoid composite index by querying only profile + status
        const q = transactionsRef
            .where('recurringProfileId', '==', profileId)
            .where('status', '==', 'pending');

        const querySnap = await q.get();

        // Filter in memory
        const docsToDelete = querySnap.docs.filter(doc => {
            const data = doc.data() as Transaction;
            return new Date(data.dueDate) > new Date();
        });

        const batchSize = 400;

        for (let i = 0; i < docsToDelete.length; i += batchSize) {
            const batch = adminDb.batch();
            docsToDelete.slice(i, i + batchSize).forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

// #endregion

// #region Transaction Actions

export async function createTransactionAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    // Manual parsing/conversion
    const dataToValidate: any = {
        ...rawData,
        amount: Number(rawData.amount),
        accountId,
        source: 'manual',
        status: rawData.status || 'pending',
        type: rawData.type || 'expense', // Default to expense for manual if not specified
    };

    if (rawData.userId) dataToValidate.userId = rawData.userId;
    if (rawData.truckId) dataToValidate.truckId = rawData.truckId;

    const validated = TransactionSchema.safeParse(dataToValidate);

    if (!validated.success) {
        return {
            message: 'error',
            error: JSON.stringify(validated.error.flatten().fieldErrors)
        };
    }

    try {
        const transactionData = {
            ...validated.data,
            createdAt: FieldValue.serverTimestamp(),
        };

        const docRef = await adminDb.collection(`accounts/${accountId}/transactions`).add(transactionData);

        // Construct the object to return for client-side state update
        const returnedTransaction: Transaction = {
            id: docRef.id,
            ...validated.data,
            // Approximate createdAt for immediate UI display without refetching
            createdAt: new Date().toISOString() as any,
        };

        return { message: 'success', transaction: returnedTransaction };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function updateTransactionAction(accountId: string, prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const id = rawData.id as string;

    if (!id || !accountId) return { message: 'error', error: 'IDs ausentes.' };

    const dataToValidate: any = { ...rawData };
    if (rawData.amount) dataToValidate.amount = Number(rawData.amount);
    if (rawData.userId) dataToValidate.userId = rawData.userId;
    if (rawData.truckId) dataToValidate.truckId = rawData.truckId;

    const validated = UpdateTransactionSchema.safeParse(dataToValidate);

    if (!validated.success) {
        return {
            message: 'error',
            error: JSON.stringify(validated.error.flatten().fieldErrors)
        };
    }

    const { id: _, ...updateData } = validated.data;
    const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    try {
        await adminDb.doc(`accounts/${accountId}/transactions/${id}`).update({
            ...cleanUpdateData,
            updatedAt: FieldValue.serverTimestamp()
        });

        // We need to return the FULL transaction object for the state update.
        // Since we did a partial update, we merge with what we know,
        // but ideally the client should merge this result with its existing state.
        // However, to be safe and consistent, we return the object that mimics a Transaction.
        // Note: We might miss fields that weren't in the form (like original createdAt),
        // but the client-side merge logic usually handles "updatedTransaction" by replacing the old one.
        // Wait, if we replace the whole object in the client state with this partial one, we might lose fields.
        // So the client must be careful or we must fetch the full doc.
        // Fetching the full doc adds latency.
        // Better approach: The client should merge.
        // BUT `TransactionsList.tsx` implementation does:
        // `setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));`
        // This REPLACES the object. So we need to return the FULL object or at least enough to not break the UI.
        // The UI needs: id, description, categoryId, amount, type, status, dueDate, recurringProfileId...

        // Let's assume the client has the old object.
        // Actually, to fully support the "Return object" pattern safely without refetching,
        // we should probably fetch the updated doc or ensure we return all fields.
        // But for performance, let's construct it merging `cleanUpdateData` with what we can't know?
        // No, we can't know the fields we didn't touch without fetching.
        // Let's fetch the fresh document to be 100% sure and safe. It's one read, very fast.

        const freshSnap = await adminDb.doc(`accounts/${accountId}/transactions/${id}`).get();
        const freshData = freshSnap.data() as Transaction;

        // Ensure we sanitize all fields that might be Timestamp objects
        const sanitizedData = { ...freshData };
        if (sanitizedData.createdAt && typeof (sanitizedData.createdAt as any).toDate === 'function') {
            sanitizedData.createdAt = (sanitizedData.createdAt as any).toDate().toISOString();
        }

        // Remove updatedAt from the spread if it exists as a Timestamp, or convert it.
        // Since Transaction type doesn't officially support updatedAt in the interface for UI (it's internal),
        // we can either add it or ignore it. To prevent the error, we must handle it.
        // Let's remove it to be safe and strictly adhere to the known type,
        // OR convert it if we want to expose it later.
        const { updatedAt, ...rest } = sanitizedData as any;

        const returnedTransaction: Transaction = {
            ...rest,
            id,
            createdAt: sanitizedData.createdAt || undefined,
            paymentDate: freshData.paymentDate, // Already string
            dueDate: freshData.dueDate // Already string
        };

        return { message: 'success', transaction: returnedTransaction };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteTransactionAction(accountId: string, transactionId: string) {
    if (!accountId || !transactionId) return { message: 'error', error: 'IDs ausentes.' };

    try {
        await adminDb.doc(`accounts/${accountId}/transactions/${transactionId}`).delete();
        // Removed revalidatePath to allow client-side optimistic updates without reload
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function toggleTransactionStatusAction(accountId: string, transactionId: string, currentStatus: string) {
     if (!accountId || !transactionId) return { message: 'error', error: 'IDs ausentes.' };

     const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
     const updateData: any = { status: newStatus };

     if (newStatus === 'paid') {
         updateData.paymentDate = new Date().toISOString();
     } else {
         updateData.paymentDate = FieldValue.delete();
     }

     try {
        await adminDb.doc(`accounts/${accountId}/transactions/${transactionId}`).update(updateData);
        // Removed revalidatePath
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}


// #endregion

// #region Integration Helpers (Used by Operational Actions)

export async function createTransactionFromService(
    accountId: string,
    serviceId: string,
    serviceType: 'rental' | 'operation',
    totalValue: number,
    clientName: string,
    completedDate: Date,
    sequentialId: number,
    status: 'pending' | 'paid' = 'pending',
    userId?: string,
    truckId?: string,
    forceDuplicate: boolean = false,
    customDescription?: string
) {
    try {
        // 1. Get default category for services ("Receita de Serviços") or create one if not exists
        // Note: In a real app we might cache this or structure it better.
        // For now, let's try to find a category named "Receita de Serviços" in the account settings.
        const accountRef = adminDb.doc(`accounts/${accountId}`);
        const accountSnap = await accountRef.get();
        let categoryId = '';

        if (accountSnap.exists) {
            const categories = (accountSnap.data() as Account).financialCategories || [];
            const serviceCategory = categories.find(c => c.name === 'Receita de Serviços' && c.type === 'income');

            if (serviceCategory) {
                categoryId = serviceCategory.id;
            } else {
                // Auto-create default category
                const newId = adminDb.collection('dummy').doc().id;
                const newCategory: TransactionCategory = {
                    id: newId,
                    name: 'Receita de Serviços',
                    type: 'income',
                    color: '#22c55e', // Green
                    isDefault: true
                };
                await accountRef.update({
                    financialCategories: FieldValue.arrayUnion(newCategory)
                });
                categoryId = newId;
            }
        }

        const description = customDescription || `Receita ${serviceType === 'rental' ? 'Aluguel' : 'Operação'} #${sequentialId} - ${clientName}`;

        const transactionData: Record<string, any> = {
            description,
            amount: totalValue,
            type: 'income',
            status: status,
            dueDate: completedDate.toISOString(), // Default due date = completion date
            categoryId,
            source: 'service',
            relatedResourceId: serviceId,
            accountId,
            createdAt: FieldValue.serverTimestamp(),
        };

        if (userId) transactionData.userId = userId;
        if (truckId) transactionData.truckId = truckId;

        if (status === 'paid') {
            transactionData.paymentDate = completedDate.toISOString();
        }

        if (forceDuplicate) {
             await adminDb.collection(`accounts/${accountId}/transactions`).add(transactionData);
        } else {
            // We use .set with merge:true in case it already exists (idempotency safety) or just add
            // Since we don't have a transaction ID here easily unless we query, let's just use add.
            // To prevent duplicates, we could query first.
            const q = adminDb.collection(`accounts/${accountId}/transactions`)
                .where('relatedResourceId', '==', serviceId)
                .limit(1);
            const existing = await q.get();

            if (!existing.empty) {
                // Update existing
                await existing.docs[0].ref.update({
                    amount: totalValue,
                    description: transactionData.description,
                    // Don't overwrite status if user manually changed it?
                    // Maybe better to leave it alone if it exists.
                    updatedAt: FieldValue.serverTimestamp()
                });
            } else {
                 await adminDb.collection(`accounts/${accountId}/transactions`).add(transactionData);
            }
        }

    } catch (e) {
        console.error("Failed to auto-create transaction:", e);
        // We don't throw here to avoid blocking the main operational flow
    }
}

export async function deleteTransactionByServiceId(accountId: string, serviceId: string) {
    try {
        const q = adminDb.collection(`accounts/${accountId}/transactions`)
            .where('relatedResourceId', '==', serviceId);

        const snapshot = await q.get();
        const batch = adminDb.batch();

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
    } catch (e) {
         console.error("Failed to auto-delete transaction:", e);
    }
}

export async function updateTransactionByServiceId(accountId: string, serviceId: string, amount: number) {
    try {
        const q = adminDb.collection(`accounts/${accountId}/transactions`)
            .where('relatedResourceId', '==', serviceId)
            .limit(1);

        const snapshot = await q.get();
        if (!snapshot.empty) {
            await snapshot.docs[0].ref.update({
                amount,
                updatedAt: FieldValue.serverTimestamp()
            });
        }
    } catch (e) {
         console.error("Failed to auto-update transaction:", e);
    }
}

// #endregion

// #region Bulk Transaction Actions

async function getGroupSiblings(accountId: string, parentId: string, date: Date, kind: 'rental' | 'operation') {
    const collection = kind === 'rental' ? 'completed_rentals' : 'completed_operations';
    const parentField = kind === 'rental' ? 'parentRentalId' : 'parentOperationId';

    // We only query by parentId to avoid composite index requirements
    const q = adminDb.collection(`accounts/${accountId}/${collection}`)
        .where(parentField, '==', parentId);

    const snap = await q.get();
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(item => {
            const d = parseFirestoreDate(item.completedDate);
            return d >= start && d <= end;
        });
}

export async function recreateTransactionAction(
    accountId: string,
    itemId: string,
    kind: 'rental' | 'operation',
    mode: 'duplicate' | 'update'
) {
    if (!accountId || !itemId) return { message: 'error', error: 'Dados inválidos.' };

    try {
        const collection = kind === 'rental' ? 'completed_rentals' : 'completed_operations';
        const docRef = adminDb.doc(`accounts/${accountId}/${collection}/${itemId}`);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return { message: 'error', error: 'Item não encontrado.' };
        }

        const item = { id: docSnap.id, ...docSnap.data() } as any;
        const parentId = kind === 'rental' ? item.parentRentalId : item.parentOperationId;
        const itemCompletedDate = parseFirestoreDate(item.completedDate);

        let targetId = item.id;
        let totalValue = item.totalValue || 0;
        let description = `Receita ${kind === 'rental' ? 'Aluguel' : 'Operação'} #${item.sequentialId} - ${item.clientName || 'Cliente'}`;

        // If grouped, fetch siblings and sum up
        if (parentId) {
            const siblings = await getGroupSiblings(accountId, parentId, itemCompletedDate, kind);

            // Sort to find the latest one (which usually holds the transaction reference)
            siblings.sort((a, b) => {
                const dateA = parseFirestoreDate(a.completedDate).getTime();
                const dateB = parseFirestoreDate(b.completedDate).getTime();
                return dateB - dateA;
            });

            if (siblings.length > 0) {
                targetId = siblings[0].id; // Use the latest item ID as the group key
                totalValue = siblings.reduce((sum, sib) => sum + (sib.totalValue || 0), 0);

                // If it's a group, the description usually refers to the monthly bill
                const latest = siblings[0];
                description = `Receita ${kind === 'rental' ? 'Aluguel' : 'Operação'} #${latest.sequentialId} (Agrupado) - ${latest.clientName || 'Cliente'}`;

                // We must use the latest item properties
                item.clientName = latest.clientName;
                item.completedDate = latest.completedDate;
                item.sequentialId = latest.sequentialId;
                item.driver = latest.driver;
                item.assignedToUser = latest.assignedToUser;
                item.truck = latest.truck;
                item.dumpsters = latest.dumpsters;
            }
        }

        await createTransactionFromService(
            accountId,
            targetId,
            kind,
            totalValue,
            item.clientName || 'Cliente',
            parseFirestoreDate(item.completedDate),
            item.sequentialId,
            'paid', // Force paid status as requested
            kind === 'rental' ? item.assignedToUser?.id : item.driver?.id,
            kind === 'rental' ? (item.dumpsters && item.dumpsters.length > 0 ? undefined : item.truckId) : item.truck?.id, // Logic for truck ID varies
            mode === 'duplicate',
            description
        );

        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export type BulkTransactionItem = {
    id: string;
    kind: 'rental' | 'operation';
    totalValue: number;
    clientName: string;
    completedDate: string;
    sequentialId: number;
    userId?: string;
    truckId?: string;
    parentId?: string;
}

export async function processBulkTransactionsAction(
    accountId: string,
    items: BulkTransactionItem[],
    mode: 'duplicate' | 'update'
) {
    if (!accountId || !items || items.length === 0) return { message: 'error', error: 'Nenhum item para processar.' };

    try {
        const groups: Record<string, BulkTransactionItem[]> = {};
        const singles: BulkTransactionItem[] = [];

        items.forEach(item => {
            if (item.parentId) {
                const date = parseISO(item.completedDate);
                const key = `${item.parentId}-${getYear(date)}-${getMonth(date)}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            } else {
                singles.push(item);
            }
        });

        // Process Singles
        for (const item of singles) {
            await createTransactionFromService(
                accountId,
                item.id,
                item.kind,
                item.totalValue,
                item.clientName,
                parseISO(item.completedDate),
                item.sequentialId,
                'paid',
                item.userId,
                item.truckId,
                mode === 'duplicate'
            );
        }

        // Process Groups
        for (const key in groups) {
            const groupItems = groups[key];
            // Sort by date desc to find latest
            groupItems.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());

            const mainItem = groupItems[0];
            const totalGroupValue = groupItems.reduce((sum, i) => sum + (i.totalValue || 0), 0);
            const description = `Receita ${mainItem.kind === 'rental' ? 'Aluguel' : 'Operação'} #${mainItem.sequentialId} (Agrupado) - ${mainItem.clientName}`;

            await createTransactionFromService(
                accountId,
                mainItem.id, // Use latest item ID as key
                mainItem.kind,
                totalGroupValue,
                mainItem.clientName,
                parseISO(mainItem.completedDate),
                mainItem.sequentialId,
                'paid',
                mainItem.userId,
                mainItem.truckId,
                mode === 'duplicate',
                description
            );
        }

        revalidatePath('/finance');
        return { message: 'success', count: items.length };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

function getYear(date: Date) {
    return date.getFullYear();
}

function getMonth(date: Date) {
    return date.getMonth();
}

// #endregion
