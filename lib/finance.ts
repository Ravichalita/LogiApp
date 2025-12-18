import { collection, query, where, getDocs, orderBy, Timestamp, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { Transaction, TransactionCategory } from '../types'; // Adjust path as needed
import { startOfMonth, endOfMonth, format } from 'date-fns';

export async function getFinancialCategories(accountId: string): Promise<TransactionCategory[]> {
    const { db } = getFirebase();
    const categoriesRef = collection(db, `accounts/${accountId}/categories`);
    const snapshot = await getDocs(categoriesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionCategory));
}

export async function getTransactions(
    accountId: string,
    params: { month?: number, year?: number, startDate?: string, endDate?: string }
): Promise<Transaction[]> {
    const { db } = getFirebase();
    const transactionsRef = collection(db, `accounts/${accountId}/transactions`);

    let q = query(transactionsRef, orderBy('dueDate', 'desc'));

    if (params.startDate && params.endDate) {
        q = query(q, where('dueDate', '>=', params.startDate), where('dueDate', '<=', params.endDate));
    } else if (params.month !== undefined && params.year !== undefined) {
        const start = format(startOfMonth(new Date(params.year, params.month)), 'yyyy-MM-dd');
        const end = format(endOfMonth(new Date(params.year, params.month)), 'yyyy-MM-dd');
        q = query(q, where('dueDate', '>=', start), where('dueDate', '<=', end));
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            // Ensure dates are handled correctly if they are Timestamps
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
        } as Transaction;
    });
}

export async function createTransaction(accountId: string, transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
    const { db } = getFirebase();
    const ref = collection(db, `accounts/${accountId}/transactions`);
    const now = new Date();

    const docRef = await addDoc(ref, {
        ...transaction,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
    });

    return docRef.id;
}

export async function toggleTransactionStatus(accountId: string, transactionId: string, currentStatus: string) {
    const { db } = getFirebase();
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const ref = doc(db, `accounts/${accountId}/transactions`, transactionId);

    await updateDoc(ref, {
        status: newStatus,
        updatedAt: Timestamp.fromDate(new Date())
    });

    return newStatus;
}

export async function deleteTransaction(accountId: string, transactionId: string) {
    const { db } = getFirebase();
    const ref = doc(db, `accounts/${accountId}/transactions`, transactionId);
    await deleteDoc(ref);
}
