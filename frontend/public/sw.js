self.addEventListener('push', function (event) {
  if (!event.data) return

  const raw = event.data.json()
  const n = raw.notification || {}
  const title = n.title || raw.title || 'Travello'
  const body = n.body || raw.body || ''
  const dataFields =
    raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data
      : {}

  const options = {
    body: body,
    icon: '/icon-192x192.png',
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
    url = '/travel-hub'
  } else if (data.type === 'incoming_call') {
    url = '/travel-hub'
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})
