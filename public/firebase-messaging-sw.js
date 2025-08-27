
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
});


// Check if firebase is defined before using it
if (typeof importScripts === 'function') {
  try {
    const urlParams = new URLSearchParams(location.search);
    const firebaseConfigEncoded = urlParams.get('firebaseConfig');

    if (!firebaseConfigEncoded) {
        console.error("Firebase config not found in service worker URL.");
    } else {
        const firebaseConfig = JSON.parse(decodeURIComponent(firebaseConfigEncoded));
        
        importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

        firebase.initializeApp(firebaseConfig);

        const messaging = firebase.messaging();
        
        messaging.onBackgroundMessage(function (payload) {
          console.log(
            '[firebase-messaging-sw.js] Received background message ',
            payload
          );
          // Customize notification here
          const notificationTitle = payload.data.title;
          const notificationOptions = {
            body: payload.data.body,
            icon: payload.data.icon,
            data: {
              link: payload.data.link
            }
          };

          self.registration.showNotification(notificationTitle, notificationOptions);
        });

        self.addEventListener('notificationclick', function(event) {
          console.log('[Service Worker] Notification click Received.');

          event.notification.close();
          const link = event.notification.data?.link || '/';
          
          event.waitUntil(
            clients.openWindow(link)
          );
        });

    }
  } catch (e) {
    console.error('Error importing or initializing Firebase in service worker:', e);
  }
}
