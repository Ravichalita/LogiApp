
'use server';

import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from './firebase-admin';
import type { UserAccount } from './types';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    link?: string;
}

export async function sendNotification({ userId, title, body, link }: NotificationPayload) {
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

        // Send data payload for full control on the client
        const message = {
            data: {
                title,
                body,
                icon: '/favicon.ico', // Optional: if you have a favicon
                link: link || '/', // Default link if none provided
            },
            tokens,
        };

        const response = await getMessaging().sendEachForMulticast(message);
        console.log(`Successfully sent message to ${response.successCount} devices.`);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const failedToken = tokens[idx];
                    console.error(`Failed to send to token: ${failedToken}`, resp.error);
                    // Check for errors indicating an invalid or unregistered token
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
