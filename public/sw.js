// Minimal service worker — enables PWA installability, push notifications,
// and a tiny offline app-shell cache.
const CACHE = 'ui-portal-v4';
const APP_SHELL = ['/', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for navigations, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // Cache-first for our own static assets.
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          // Only cache successful, basic (same-origin, non-opaque) responses so
          // a 404/redirect can't poison the cache and white-screen the app.
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached)
      )
    );
  }
});

// --- Push notifications ---
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Unknown IITians', body: event.data ? event.data.text() : '' };
  }

  const baseTitle = data.title || 'Unknown IITians';
  const tag = data.tag;
  const newLine = data.body || '';

  event.waitUntil((async () => {
    let lines = newLine ? [newLine] : [];
    let count = 1;

    // WhatsApp-style threading: when a chat push (data.stack) arrives for a
    // thread that still has an unseen notification, COMPILE the messages into
    // one notification instead of replacing it with only the latest line.
    // Once the user opens/taps it the notification is cleared, so the next
    // message starts a fresh stack.
    if (data.stack && tag) {
      try {
        const existing = await self.registration.getNotifications({ tag });
        if (existing.length > 0) {
          const prev = existing[0].data || {};
          const prevLines = Array.isArray(prev.lines)
            ? prev.lines
            : (existing[0].body ? existing[0].body.split('\n') : []);
          const prevCount = typeof prev.count === 'number' ? prev.count : prevLines.length;
          lines = prevLines.concat(newLine).filter(Boolean).slice(-10);
          count = prevCount + 1;
        }
      } catch (e) { /* getNotifications unsupported — fall back to single line */ }
    }

    // Show the most recent 6 lines; note how many older ones are folded away.
    const shown = lines.slice(-6);
    const hidden = count - shown.length;
    const body = (hidden > 0 ? `+${hidden} earlier\n` : '') + shown.join('\n');
    const title = (data.stack && count > 1) ? `${baseTitle} (${count} new)` : baseTitle;

    const options = {
      body: body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag,
      renotify: !!tag,
      data: { url: data.url || '/', lines: lines, count: count },
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
