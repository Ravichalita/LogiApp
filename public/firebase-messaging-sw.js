
// This file needs to be in the public directory.
// It must be named firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// Pass in the messagingSenderId.
// This is the only part that needs to be configured.
const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = JSON.parse(urlParams.get('firebaseConfig'));

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/**
 * The service worker will not receive data messages when the app is in the
 * foreground. You can check if the app is in the foreground or background
 * using the visibilitystate property of the document.
 *
 * This service worker will be used for all notifications, not just tests.
 * It will always show a system notification.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon || '/favicon.ico',
    data: {
      link: payload.data.link
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const link = event.notification.data.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if a window is already open.
      const existingClient = windowClients.find(client => {
        const url = new URL(client.url);
        return url.pathname === '/'; // Adjust if you have more specific needs
      });

      if (existingClient) {
        // If so, focus it and navigate.
        return existingClient.navigate(link).then(client => client.focus());
      } else {
        // If not, open a new window.
        return clients.openWindow(link);
      }
    })
  );
});
