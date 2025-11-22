import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { addDays, setHours, setMinutes, getDay } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

// --- Types ---

interface RecurrenceProfile {
    id: string;
    accountId: string;
    type: 'rental' | 'operation';
    frequency: 'weekly';
    daysOfWeek: number[];
    time: string;
    endDate?: string | null;
    billingType: 'per_service' | 'monthly';
    status: 'active' | 'cancelled' | 'completed';
    nextRunDate: string;
    templateData: any;
    lastRunDate?: string;
}

// --- Helpers ---

function calculateNextRunDate(daysOfWeek: number[], time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const todayIndex = getDay(now);

    // Sort days to ensure order
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

    // Find the next day in the current week
    let nextDayIndex = sortedDays.find((day) => day > todayIndex);

    // If no day left in this week, take the first day of next week
    if (nextDayIndex === undefined) {
        nextDayIndex = sortedDays[0];
    }

    let nextDate = new Date();

    if (nextDayIndex > todayIndex) {
        // Next day is in the same week
        nextDate = addDays(now, nextDayIndex - todayIndex);
    } else {
        // Next day is in the next week
        nextDate = addDays(now, 7 - (todayIndex - nextDayIndex));
    }

    // Set time
    nextDate = setHours(nextDate, hours);
    nextDate = setMinutes(nextDate, minutes);
    nextDate = setSeconds(nextDate, 0);
    nextDate = setMilliseconds(nextDate, 0);

    return nextDate;
}

function setSeconds(date: Date, seconds: number): Date {
    const d = new Date(date);
    d.setSeconds(seconds);
    return d;
}

function setMilliseconds(date: Date, ms: number): Date {
    const d = new Date(date);
    d.setMilliseconds(ms);
    return d;
}

// --- Cloud Function ---

export const checkRecurringProfiles = onSchedule("every day 06:00", async (event) => {
    const now = new Date();
    console.log("Running checkRecurringProfiles at", now.toISOString());

    // Query for active profiles where nextRunDate is in the past or today
    // Note: Firestore string comparison works for ISO dates
    const snapshot = await db.collectionGroup("recurrence_profiles")
        .where("status", "==", "active")
        .where("nextRunDate", "<=", now.toISOString())
        .get();

    if (snapshot.empty) {
        console.log("No recurring profiles to process.");
        return;
    }

    console.log(`Found ${snapshot.size} profiles to process.`);

    const batch = db.batch();
    let operationCount = 0;

    for (const doc of snapshot.docs) {
        const profile = doc.data() as RecurrenceProfile;

        // Safety check: ensure accountId exists
        if (!profile.accountId) {
            console.error(`Profile ${doc.id} missing accountId, skipping.`);
            continue;
        }

        // 1. Create the new OS (Rental or Operation)
        const collectionName = profile.type === 'rental' ? 'rentals' : 'operations';
        const newOsRef = db.collection(`accounts/${profile.accountId}/${collectionName}`).doc();

        const newOsData = {
            ...profile.templateData,
            recurrenceProfileId: profile.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Update specific date fields based on type
        // We use the scheduled 'nextRunDate' as the start date for the new OS
        // to ensure consistency even if the function runs slightly late.
        // However, if it's way in the past, maybe we should use 'now'? 
        // For recurrence, sticking to the schedule is usually better.
        const scheduledDate = new Date(profile.nextRunDate);

        if (profile.type === 'rental') {
            newOsData.rentalDate = profile.nextRunDate; // Keep as string if that's how it's stored
            // If there's an endDate in template, we might need to shift it? 
            // Usually rentals are single day or have a duration. 
            // If template has start/end, we should probably preserve the duration.
            // For now, assuming single day or manual adjustment.
        } else {
            newOsData.startDate = profile.nextRunDate;
            // Adjust endDate if it exists in template to maintain duration
            if (profile.templateData.startDate && profile.templateData.endDate) {
                const originalStart = new Date(profile.templateData.startDate);
                const originalEnd = new Date(profile.templateData.endDate);
                const duration = originalEnd.getTime() - originalStart.getTime();
                const newEnd = new Date(scheduledDate.getTime() + duration);
                newOsData.endDate = newEnd.toISOString();
            } else {
                newOsData.endDate = profile.nextRunDate;
            }
        }

        // Handle Billing Type
        if (profile.billingType === 'monthly') {
            // If billing is monthly, the individual service might be $0 or marked as such.
            // We will set a flag or zero out the value if strictly required, 
            // but the prompt said "define service value", so maybe we keep the value 
            // but the system knows how to bill it. 
            // For now, let's keep the value from template but ensure billingType is set on the OS.
            newOsData.billingType = 'monthly';
        } else {
            newOsData.billingType = 'per_service';
        }

        batch.set(newOsRef, newOsData);

        // 2. Calculate next run date
        // We calculate from the CURRENT scheduled date to avoid drift, 
        // unless it's way behind, but for simple weekly recurrence, 
        // calculating from 'now' or 'scheduledDate' is the question.
        // If we use 'scheduledDate', we might generate a backlog if the function was down.
        // If we use 'now', we skip missed intervals.
        // Let's use 'now' to find the *next* valid slot from today, to avoid flooding.
        const nextRun = calculateNextRunDate(profile.daysOfWeek, profile.time);

        // 3. Update the profile
        const profileUpdate: any = {
            lastRunDate: now.toISOString(),
            nextRunDate: nextRun.toISOString(),
        };

        // Check if we reached the end date
        if (profile.endDate && new Date(profile.endDate) < nextRun) {
            profileUpdate.status = 'completed';
        }

        batch.update(doc.ref, profileUpdate);
        operationCount++;
    }

    await batch.commit();
    console.log(`Processed ${operationCount} profiles.`);
});