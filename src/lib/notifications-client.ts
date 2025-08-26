
'use client';

// This file is for client-side notification logic, like triggering a server action to send a notification.
// This is useful for notifications that should be triggered by a client-side event but sent from the server.

import { sendNotification as sendNotificationServerAction } from './notifications';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    link?: string;
}

// A simple wrapper to call a server action. For now, it just logs to console.
// In a real app, this would be a server action that calls the admin-side `sendNotification`.
export async function sendNotification(payload: NotificationPayload) {
    console.log("Client is requesting to send a notification:", payload);
    // In a real implementation, you would have a server action here:
    await sendNotificationServerAction(payload);
}
