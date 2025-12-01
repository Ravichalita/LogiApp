import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { addDays, setHours, setMinutes, getDay, differenceInDays, parseISO } from "date-fns";
// import { getStorage } from "firebase-admin/storage";

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

interface Account {
    id: string;
    lastBackupDate?: string;
    backupPeriodicityDays?: number;
    backupRetentionDays?: number;
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

async function copyCollection(
    firestore: FirebaseFirestore.Firestore,
    sourcePath: string,
    destPath: string
) {
    const sourceRef = firestore.collection(sourcePath);
    const documents = await sourceRef.get();

    if (documents.empty) return;

    let batch = firestore.batch();
    let i = 0;
    for (const doc of documents.docs) {
        const destRef = firestore.doc(`${destPath}/${doc.id}`);
        batch.set(destRef, doc.data());
        i++;
        if (i % 500 === 0) { // Commit every 500 documents
            await batch.commit();
            batch = firestore.batch();
        }
    }
    if (i % 500 !== 0) {
        await batch.commit();
    }
}

async function deleteCollectionByPath(firestore: FirebaseFirestore.Firestore, collectionPath: string, batchSize: number): Promise<string[]> {
    const collectionRef = firestore.collection(collectionPath);
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    const attachmentPaths: string[] = [];

    while (true) {
        const snapshot = await query.get();
        if (snapshot.empty) {
            break;
        }

        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.attachments && Array.isArray(data.attachments)) {
                for (const attachment of data.attachments) {
                    if (attachment.path) {
                        attachmentPaths.push(attachment.path);
                    }
                }
            }
            batch.delete(doc.ref);
        });
        await batch.commit();

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).startAfter(lastVisible).limit(batchSize);
    }

    return attachmentPaths;
}

// async function deleteStorageFile(pathOrUrl: string) {
//     try {
//         let objectPath = pathOrUrl;
//         if (/^https?:\/\//.test(objectPath)) {
//             const url = new URL(objectPath);
//             const decodedPath = decodeURIComponent(url.pathname);
//             const pathSegments = decodedPath.split('/o/');
//             if (pathSegments.length > 1) {
//                 objectPath = pathSegments[1];
//             }
//         }
//         const bucket = getStorage().bucket();
//         await bucket.file(objectPath).delete({ ignoreNotFound: true });
//     } catch (e) {
//         console.error("Error deleting storage file:", e);
//     }
// }

async function cleanupOldBackups(accountId: string, retentionDays: number) {
    const now = new Date();
    const retentionDate = new Date(now.setDate(now.getDate() - retentionDays));

    const oldBackupsQuery = db.collection('backups')
        .where('accountId', '==', accountId)
        .where('createdAt', '<', retentionDate)
        .where('status', '==', 'completed');

    const snapshot = await oldBackupsQuery.get();

    if (snapshot.empty) return;

    console.log(`Deleting ${snapshot.size} old backups for account ${accountId}`);

    for (const doc of snapshot.docs) {
        const backupId = doc.id;
        // const subcollections = ['accounts']; // Start with accounts subcollection wrapper

        // Note: The structure in backups is backups/{backupId}/accounts/{accountId}/{collection}
        // We first delete the subcollections under accounts/{accountId}
        const accountBackupRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
        const innerCollections = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];

        for (const col of innerCollections) {
            await deleteCollectionByPath(db, `backups/${backupId}/accounts/${accountId}/${col}`, 50);
        }

        // Delete the account doc itself in backup
        await accountBackupRef.delete();

        // Delete the backup document itself
        await db.doc(`backups/${backupId}`).delete();
    }
}

// --- Cloud Functions ---

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

            const newOsData: any = {
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

export const scheduledBackups = onSchedule("every day 01:00", async (event) => {
    const now = new Date();
    console.log("Running scheduledBackups at", now.toISOString());

    const accountsSnap = await db.collection("accounts").get();

    if (accountsSnap.empty) {
        console.log("No accounts found.");
        return;
    }

    for (const doc of accountsSnap.docs) {
        const account = doc.data() as Account;
        const accountId = doc.id;

        const backupPeriodicityDays = account.backupPeriodicityDays || 7;
        const lastBackupDate = account.lastBackupDate;

        let shouldBackup = false;

        if (!lastBackupDate) {
            shouldBackup = true;
        } else {
            const daysSinceLastBackup = differenceInDays(now, parseISO(lastBackupDate));
            if (daysSinceLastBackup >= backupPeriodicityDays) {
                shouldBackup = true;
            }
        }

        if (shouldBackup) {
            console.log(`Starting backup for account ${accountId}...`);
            const timestamp = new Date();
            const backupId = `backup-${timestamp.toISOString()}`;
            const backupDocRef = db.collection(`backups`).doc(backupId);

            try {
                await backupDocRef.set({
                    accountId: accountId,
                    createdAt: timestamp,
                    status: 'in-progress'
                });

                const subcollectionsToBackup = ['clients', 'dumpsters', 'rentals', 'completed_rentals', 'trucks', 'operations', 'completed_operations'];

                // Backup account doc
                const backupAccountRef = db.doc(`backups/${backupId}/accounts/${accountId}`);
                await backupAccountRef.set(account);

                // Backup subcollections
                for (const subcollection of subcollectionsToBackup) {
                    const sourcePath = `accounts/${accountId}/${subcollection}`;
                    const destPath = `backups/${backupId}/accounts/${accountId}/${subcollection}`;
                    await copyCollection(db, sourcePath, destPath);
                }

                await backupDocRef.update({
                    status: 'completed'
                });

                await db.doc(`accounts/${accountId}`).update({
                    lastBackupDate: timestamp.toISOString()
                });

                console.log(`Backup completed for account ${accountId}.`);

                if (account.backupRetentionDays && account.backupRetentionDays > 0) {
                    await cleanupOldBackups(accountId, account.backupRetentionDays);
                }

            } catch (error) {
                console.error(`Backup failed for account ${accountId}:`, error);
                await backupDocRef.update({
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
});
