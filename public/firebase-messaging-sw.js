// public/firebase-messaging-sw.js
self.addEventListener('push', (event) => {
  if (!event.data) {
    // sem payload — nada a fazer
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    console.error('Push event: payload parse error', err);
    return;
  }

  // suporte a várias formas (notification / data / flat)
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    payload.title ||
    'Nova Notificação';

  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    payload.body ||
    '';

  const image =
    (payload.notification && payload.notification.image) ||
    (payload.webpush && payload.webpush.notification && payload.webpush.notification.image) ||
    (payload.data && payload.data.imageUrl) ||
    payload.imageUrl ||
    undefined;

  const link =
    (payload.webpush && payload.webpush.fcmOptions && payload.webpush.fcmOptions.link) ||
    (payload.data && payload.data.link) ||
    payload.link ||
    '/';

  const options = {
    body,
    icon: (payload.notification && payload.notification.icon) || (payload.data && payload.data.icon) || '/favicon.ico',
    image, // undefined ok
    data: { url: link },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        // foca na aba se já estiver aberta
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
