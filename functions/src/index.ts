/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Ensure app is initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const storage = getStorage();

async function getCollectionData(collectionPath: string) {
  const snapshot = await db.collection(collectionPath).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export const backupAccountData = onCall(
  { region: "us-central1" },
  async (request) => {
    const { accountId } = request.data;
    if (!accountId) {
      throw new https.HttpsError(
        "invalid-argument",
        "The function must be called with an 'accountId' argument."
      );
    }
    logger.info(`Starting backup for account: ${accountId}`);

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

      return {
        message: "Backup concluído com sucesso!",
        filePath: filePath,
        fileName: fileName,
      };
    } catch (error) {
      logger.error(`Backup failed for account ${accountId}:`, error);
      if (error instanceof https.HttpsError) {
        throw error;
      }
      throw new https.HttpsError(
        "internal",
        "Ocorreu um erro interno ao criar o backup."
      );
    }
  }
);
