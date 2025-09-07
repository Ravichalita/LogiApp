
'use server';

import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebase-admin';
import type { UserAccount } from './types';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    imageUrl?: string;
    linkUrl?: string;
}

export async function sendNotification({ userId, title, body, imageUrl, linkUrl }: NotificationPayload) {
    if (!userId) return;

    try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.error(`User ${userId} not found, cannot send notification.`);
            return;
        }

        const userData = userDoc.data() as UserAccount;
        const tokens = userData.fcmTokens;

        if (!tokens || tokens.length === 0) {
            console.log(`User ${userId} has no FCM tokens. Skipping notification.`);
            return;
        }
        
        const finalBody = linkUrl ? `${body}\n${linkUrl}` : body;

        const message ={
            notification: {
                title,
                body: finalBody,
                image: imageUrl || undefined,
            },

            tokens,
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`Successfully sent message to ${response.successCount} devices.`);

        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const failedToken = tokens[idx];
                    console.error(`Failed to send to token: ${failedToken}`, resp.error);
                    if (
                        resp.error.code === 'messaging/invalid-registration-token' ||
                        resp.error.code === 'messaging/registration-token-not-registered'
                    ) {
                        tokensToRemove.push(failedToken);
                    }
                }
            });

            if (tokensToRemove.length > 0) {
                const updatedTokens = tokens.filter(token => !tokensToRemove.includes(token));
                await adminDb.collection('users').doc(userId).update({ fcmTokens: updatedTokens });
                console.log(`Removed ${tokensToRemove.length} invalid tokens for user ${userId}.`);
            }
        }
    } catch (error) {
        console.error('Error sending FCM message:', error);
    }
}
