
'use server';

import { adminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
    TransactionCategorySchema,
    TransactionSchema,
    UpdateTransactionSchema,
    AccountSchema
} from './types';
import type {
    Transaction,
    TransactionCategory,
    Account
} from './types';

// #region Helper Functions

function handleFirebaseError(error: unknown): string {
    let message = 'Ocorreu um erro desconhecido.';
    if (error instanceof Error) {
        message = error.message;
    }
    return message;
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

        await adminDb.collection(`accounts/${accountId}/transactions`).add(transactionData);
        revalidatePath('/finance');
        return { message: 'success' };
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
        revalidatePath('/finance');
        return { message: 'success' };
    } catch (e) {
        return { message: 'error', error: handleFirebaseError(e) };
    }
}

export async function deleteTransactionAction(accountId: string, transactionId: string) {
    if (!accountId || !transactionId) return { message: 'error', error: 'IDs ausentes.' };

    try {
        await adminDb.doc(`accounts/${accountId}/transactions/${transactionId}`).delete();
        revalidatePath('/finance');
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
        revalidatePath('/finance');
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
