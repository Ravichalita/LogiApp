
import { addDays, addWeeks, addMonths, addYears, format, getDay, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { RecurringTransactionProfile, Transaction } from './types';
import { FieldValue } from 'firebase-admin/firestore';

export function generateTransactionsForProfile(
    profile: RecurringTransactionProfile,
    accountId: string
): Omit<Transaction, 'id'>[] {
    const transactions: Omit<Transaction, 'id'>[] = [];
    let currentDate = startOfDay(parseISO(profile.startDate));
    // Reduced to 6 months to prevent exceeding Firestore batch limits (500 ops)
    // Daily for 6 months = ~180 writes, which is safe for a batch.
    const endDate = profile.endDate ? startOfDay(parseISO(profile.endDate)) : addMonths(new Date(), 6);
    const maxDate = addMonths(new Date(), 6);

    if (isAfter(currentDate, endDate)) return [];

    let iterations = 0;
    const MAX_ITERATIONS = 365 * 1;

    while (
        (isBefore(currentDate, endDate) || currentDate.getTime() === endDate.getTime()) &&
        isBefore(currentDate, maxDate) &&
        iterations < MAX_ITERATIONS
    ) {
        iterations++;

        let shouldGenerate = false;

        if (profile.frequency === 'daily') {
            if (profile.daysOfWeek && profile.daysOfWeek.includes(getDay(currentDate))) {
                shouldGenerate = true;
            } else if (!profile.daysOfWeek || profile.daysOfWeek.length === 0) {
                 shouldGenerate = true;
            }
        } else {
            shouldGenerate = true;
        }

        if (shouldGenerate) {
            transactions.push({
                description: profile.description,
                amount: profile.amount,
                type: profile.type,
                status: 'pending',
                dueDate: format(currentDate, 'yyyy-MM-dd'),
                categoryId: profile.categoryId,
                source: 'manual',
                recurringProfileId: profile.id,
                accountId: accountId,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        switch (profile.frequency) {
            case 'daily':
                currentDate = addDays(currentDate, 1);
                break;
            case 'weekly':
                currentDate = addWeeks(currentDate, 1);
                break;
            case 'biweekly':
                currentDate = addWeeks(currentDate, 2);
                break;
            case 'monthly':
                currentDate = addMonths(currentDate, 1);
                break;
        }
    }

    return transactions;
}
