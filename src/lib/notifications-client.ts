
'use client';

// This file is for client-side notification logic, like triggering a server action to send a notification.
// This is useful for notifications that should be triggered by a client-side event but sent from the server.

import { sendNotification as sendNotificationServerAction } from './notifications';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    link?: string;
    isTest?: boolean;
}

// A simple wrapper to call a server action.
export async function sendNotification(payload: NotificationPayload) {
    try {
        await sendNotificationServerAction(payload);
    } catch (error) {
        console.error("Failed to send notification via server action:", error);
        // Optionally, handle the error in the UI
    }
}
