
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import * as cors from 'cors';

const corsHandler = cors({origin: true});

// Ensure app is initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const storage = getStorage();
const auth = getAuth();


async function getCollectionData(collectionPath: string) {
  const snapshot = await db.collection(collectionPath).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export const backupAccountData = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    corsHandler(req, res, async () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.error('Unauthorized: No authorization token was provided.');
            res.status(403).send({ error: { message: 'Unauthorized' }});
            return;
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (error) {
            logger.error('Unauthorized: Error verifying token:', error);
            res.status(403).send({ error: { message: 'Unauthorized: Invalid token' }});
            return;
        }

        const { accountId } = req.body;
        if (!accountId) {
            res.status(400).send({ error: { message: "The function must be called with an 'accountId' argument." }});
            return;
        }
        
        // IMPORTANT: Verify that the authenticated user has rights to this account via custom claims.
        const userAccountId = decodedToken.accountId;
        if (userAccountId !== accountId) {
            logger.warn(`Permission denied: User ${decodedToken.uid} tried to backup account ${accountId} but belongs to ${userAccountId}`);
            res.status(403).send({ error: { message: 'You do not have permission to backup this account.' }});
            return;
        }

        logger.info(`Starting backup for account: ${accountId} by user ${decodedToken.uid}`);

        try {
            const collectionsToBackup = [
                "clients",
                "dumpsters",
                "rentals",
                "completed_rentals",
            ];
            const backupData: { [key: string]: any } = {
                exportedAt: new Date().toISOString(),
            };

            for (const collectionName of collectionsToBackup) {
                const collectionPath = `accounts/${accountId}/${collectionName}`;
                backupData[collectionName] = await getCollectionData(collectionPath);
                logger.info(
                `Backed up ${backupData[collectionName].length} documents from ${collectionName}.`
                );
            }
            
            const accountSnap = await db.doc(`accounts/${accountId}`).get();
            if(accountSnap.exists) {
                backupData.account = { id: accountSnap.id, ...accountSnap.data() };
            }


            const timestamp = new Date().toISOString().replace(/:/g, "-");
            const fileName = `backup-${timestamp}.json`;
            const filePath = `backups/${accountId}/${fileName}`;
            const file = storage.bucket().file(filePath);

            await file.save(JSON.stringify(backupData, null, 2), {
                contentType: "application/json",
            });

            logger.info(`Backup for account ${accountId} completed successfully. Saved to ${filePath}`);

            res.status(200).send({
                message: "Backup concluído com sucesso!",
                filePath: filePath,
                fileName: fileName,
            });

        } catch (error) {
            logger.error(`Backup failed for account ${accountId}:`, error);
            res.status(500).send({ error: { message: 'Ocorreu um erro interno ao criar o backup.' }});
        }
    });
  }
);

    