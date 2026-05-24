self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Fi';
  const options = {
    body: payload.body || 'New update from Fi.',
    icon: payload.icon || '/icons/fi-icon-192.png',
    badge: payload.badge || '/icons/fi-icon-192.png',
    tag: payload.tag || 'fi-push',
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = windowClients.find((client) => client.url === targetUrl);

    if (existingClient) {
      await existingClient.focus();
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
