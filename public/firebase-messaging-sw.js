
// Import and initialize Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

// This is a special query parameter that will be added by the client
const firebaseConfig = new URL(location).searchParams.get('firebaseConfig');
if (!firebaseConfig) {
    throw new Error('Firebase config not found in service worker query parameters.');
}
const app = initializeApp(JSON.parse(firebaseConfig));
const messaging = getMessaging(app);

// --- Push Event Handler ---
// This is the core logic that handles incoming push notifications when the app is in the background.
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    if (!event.data) {
        console.log('[Service Worker] Push event but no data');
        return;
    }

    try {
        const notificationData = event.data.json();
        console.log('[Service Worker] Notification data:', notificationData);

        const title = notificationData.data.title || 'Nova Notificação';
        const options = {
            body: notificationData.data.body || 'Você tem uma nova atualização.',
            icon: notificationData.data.icon || '/favicon.ico',
            badge: '/badge.png', // Optional: an icon for the notification tray
            data: {
                link: notificationData.data.link || '/',
            },
        };

        // This tells the browser to wait until the notification is shown.
        // It's crucial for preventing the "This site has been updated..." message.
        event.waitUntil(self.registration.showNotification(title, options));

    } catch (e) {
        console.error('[Service Worker] Error processing push event:', e);
        // Fallback notification if parsing fails
        const title = "Nova Notificação";
        const options = { body: "Você recebeu uma nova atualização." };
        event.waitUntil(self.registration.showNotification(title, options));
    }
});


// --- Notification Click Handler ---
// This handles what happens when a user clicks on the notification.
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click Received.');

    // Close the notification pop-up
    event.notification.close();

    const linkToOpen = event.notification.data.link || '/';

    // This looks for an existing window/tab for your site and focuses it.
    // If it can't find one, it opens a new one.
    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((clientList) => {
        for (const client of clientList) {
            // Check if the client is already on the target link
            if (client.url === linkToOpen && 'focus' in client) {
                return client.focus();
            }
        }
        // If no client is found or none match, open a new window
        if (clients.openWindow) {
            return clients.openWindow(linkToOpen);
        }
    });

    event.waitUntil(promiseChain);
});
