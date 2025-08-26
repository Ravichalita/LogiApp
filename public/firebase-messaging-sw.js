
// Check if Firebase has already been initialized
if (typeof self.firebase === 'undefined' || !self.firebase.apps.length) {
    // Scripts for Firebase
    self.importScripts('https://www.gstatic.com/firebasejs/9.10.0/firebase-app-compat.js');
    self.importScripts('https://www.gstatic.com/firebasejs/9.10.0/firebase-messaging-compat.js');
    
    // Get the config from the query parameter
    const urlParams = new URLSearchParams(location.search);
    const firebaseConfig = JSON.parse(urlParams.get('firebaseConfig'));
    
    // Initialize Firebase
    self.firebase.initializeApp(firebaseConfig);
}

const messaging = self.firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
