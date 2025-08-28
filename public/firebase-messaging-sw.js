// Import and initialize the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// Parse the config from the query string
const urlParams = new URLSearchParams(self.location.search);
const firebaseConfig = JSON.parse(urlParams.get('firebaseConfig'));

// Initialize Firebase
if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// This listener handles notifications when the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize the notification here
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon || '/favicon.ico',
    data: {
        link: payload.data.link || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// This listener handles the click event on a notification.
self.addEventListener('notificationclick', function(event) {
    event.notification.close(); // Close the notification

    const link = event.notification.data.link || '/';

    // This looks for an existing window and focuses it if it exists.
    // If it doesn't exist, it opens a new one.
    event.waitUntil(
        clients.matchAll({
            type: "window"
        })
        .then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url == '/' && 'focus' in client)
                    return client.focus();
            }
            if (clients.openWindow)
                return clients.openWindow(link);
        })
    );
});
