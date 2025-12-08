
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
    RecurringTransactionProfile
} from './types';
import { generateTransactionsForProfile } from './recurring-utils';

// #region Helper Functions

function handleFirebaseError(error: unknown): string {
    let message = 'Ocorreu um erro desconhecido.';
    if (error instanceof Error) {
        message = error.message;
    }
    return message;
}

function serializeTimestamp(value: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Timestamp || (typeof value === 'object' && typeof value.toDate === 'function')) {
        return value.toDate().toISOString();
    }
    return undefined;
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
    const dataToValidate = {
        ...rawData,
        amount: Number(rawData.amount),
        accountId,
        source: 'manual',
        status: rawData.status || 'pending',
        type: rawData.type || 'expense', // Default to expense for manual if not specified
    };

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
        // We fetch the fresh document to be 100% sure and safe. It's one read, very fast.

        const freshSnap = await adminDb.doc(`accounts/${accountId}/transactions/${id}`).get();
        const freshData = freshSnap.data() as Transaction | undefined;

        if (!freshData) throw new Error("Transação não encontrada após atualização.");

        const returnedTransaction: Transaction = {
            ...freshData,
            id,
            // Explicitly sanitize Timestamps to Strings for Client Component
            createdAt: serializeTimestamp(freshData.createdAt),
            updatedAt: serializeTimestamp((freshData as any).updatedAt),
            paymentDate: serializeTimestamp(freshData.paymentDate) || freshData.paymentDate, // Might already be string
            dueDate: serializeTimestamp(freshData.dueDate) || freshData.dueDate // Might already be string
        } as Transaction;

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
    status: 'pending' | 'paid' = 'pending'
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

        const transactionData = {
            description: `Receita ${serviceType === 'rental' ? 'Aluguel' : 'Operação'} #${sequentialId} - ${clientName}`,
            amount: totalValue,
            type: 'income',
            status: status,
            dueDate: completedDate.toISOString(), // Default due date = completion date
            paymentDate: status === 'paid' ? completedDate.toISOString() : undefined,
            categoryId,
            source: 'service',
            relatedResourceId: serviceId,
            accountId,
            createdAt: FieldValue.serverTimestamp(),
        };

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
