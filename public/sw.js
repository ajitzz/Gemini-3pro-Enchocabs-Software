self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: 'Driver Tracker', body: event.data.text() };
  }

  const title = payload.title || 'Driver Tracker';
  const options = {
    body: payload.body || 'New update available',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || 'driver-update',
    data: {
      url: payload.url || '/portal',
      meta: payload.meta || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/portal';

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.includes(targetUrl) && 'focus' in client) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
