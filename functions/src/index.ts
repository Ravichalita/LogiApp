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
        try {
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

            const scheduledDate = new Date(profile.nextRunDate);

            if (profile.type === 'rental') {
                newOsData.rentalDate = profile.nextRunDate;
            } else { // operation
                newOsData.startDate = profile.nextRunDate;
                if (profile.templateData.startDate && profile.templateData.endDate) {
                    const originalStart = new Date(profile.templateData.startDate);
                    const originalEnd = new Date(profile.templateData.endDate);
                    if (!isNaN(originalStart.getTime()) && !isNaN(originalEnd.getTime())) {
                        const duration = originalEnd.getTime() - originalStart.getTime();
                        if (duration >= 0) {
                            const newEnd = new Date(scheduledDate.getTime() + duration);
                            newOsData.endDate = newEnd.toISOString();
                        } else {
                            newOsData.endDate = profile.nextRunDate;
                        }
                    } else {
                        newOsData.endDate = profile.nextRunDate;
                    }
                } else {
                    newOsData.endDate = profile.nextRunDate;
                }
            }
            
            // Set the billing type based on the recurrence profile
            newOsData.billingType = profile.billingType === 'monthly' ? 'monthly' : 'per_service';

            batch.set(newOsRef, newOsData);

            // 2. Calculate next run date
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
        } catch (error) {
            console.error(`Error processing profile ${doc.id}:`, error);
            // Optionally update the profile to a 'failed' status to prevent retries
            // batch.update(doc.ref, { status: 'failed', error: error.message });
        }
    }

    await batch.commit();
    console.log(`Successfully processed ${operationCount} profiles.`);
});

    