self.addEventListener('push', function (event) {
  if (!event.data) return

  const raw = event.data.json()
  const n = raw.notification || {}
  const title = n.title || raw.title || 'Rovvy'
  const body = n.body || raw.body || ''
  const dataFields =
    raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data
      : {}

  const options = {
    body: body,
    icon: '/brand/rovvy_icon.png',
    badge: '/badge-72x72.png',
    data: dataFields,
    actions: raw.actions || [],
    vibrate: [200, 100, 200],
    tag: raw.tag || dataFields.tag || 'travello-notification',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const data = event.notification.data || {}
  let url = '/'

  if (data.type === 'group_invite') {
    url = '/notifications'
  } else if (data.type === 'new_message') {
    url = '/explore'
  } else if (data.type === 'incoming_call') {
    url = '/explore'
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

const MAP_CACHE_NAME = "map-tiles-cache-v1";

self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  if (url.pathname === "/cart/extract" && event.request.method === "GET") {
    const sharedUrl = url.searchParams.get("url") || url.searchParams.get("text");
    if (sharedUrl) {
      event.respondWith(
        Response.redirect(
          "/cart/extract?url=" + encodeURIComponent(sharedUrl),
          303
        )
      );
      return;
    }
  }
  if (url.hostname.includes("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then(function (cache) {
        return cache.match(event.request).then(function (response) {
          const fetchPromise = fetch(event.request).then(function (networkResponse) {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});
