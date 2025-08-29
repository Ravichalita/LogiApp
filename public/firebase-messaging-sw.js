
// Import the Firebase app and messaging libraries
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Get the Firebase config from the query parameter
const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = JSON.parse(urlParams.get('firebaseConfig'));

// Initialize the Firebase app in the service worker
if (firebaseConfig) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // If you want to handle push messages in the background, you can add a listener here.
    // This is useful for displaying notifications when the app is not in the foreground.
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        
        // Customize the notification here
        const notificationTitle = payload.data.title || 'Nova Notificação';
        const notificationOptions = {
            body: payload.data.body || 'Você tem uma nova mensagem.',
            icon: payload.data.icon || '/favicon.ico',
            data: {
                link: payload.data.link || '/'
            }
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
    });
    
self.addEventListener('fetch', (event) => {
});

} else {
    console.error("Firebase config not found in service worker query parameters.");
}


// Optional: Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);

    event.notification.close();

    const link = event.notification.data?.link || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                client.navigate(link);
                return client.focus();
            }
            return clients.openWindow(link);
        })
    );
});
