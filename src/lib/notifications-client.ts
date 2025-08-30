
'use client';

// This file is for client-side notification logic, like triggering a server action to send a notification.
// This is useful for notifications that should be triggered by a client-side event but sent from the server.

import { sendNotification as sendNotificationServerAction } from './notifications';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
}

// A simple wrapper to call a server action.
export async function sendNotification(payload: NotificationPayload) {
    try {
        // Use a timeout to ensure the user document update (hasSeenWelcome) doesn't race with the notification check.
        // This gives the Firestore update a moment to complete before the server action reads the document.
        setTimeout(() => {
            sendNotificationServerAction(payload).catch(console.error);
        }, 1000);
    } catch (error) {
        console.error("Failed to send notification via server action:", error);
        // Optionally, handle the error in the UI
    }
}
