const CACHE_NAME = 'habitflow-v3';

// ── Install — pre-cache shell ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/index.html', '/manifest.json', '/favicon.svg'])
    )
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache API calls — let them fail naturally (app handles offline)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return; // Let the browser handle it (no SW intercept)
  }

  // Immutable assets (Vite adds content hash) — cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // HTML and other app shell — network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Reminder scheduling ───────────────────────────────────────────────────────
const scheduledTimers = new Map();

function scheduleReminder(habit) {
  if (scheduledTimers.has(habit.id)) {
    clearTimeout(scheduledTimers.get(habit.id));
    scheduledTimers.delete(habit.id);
  }
  if (!habit.reminderTime) return;

  const [hours, minutes] = habit.reminderTime.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const delay = target.getTime() - now.getTime();
  const timerId = setTimeout(async () => {
    scheduledTimers.delete(habit.id);
    await self.registration.showNotification(`${habit.icon} ${habit.name}`, {
      body: 'Hora de marcar esse hábito como concluído! ✅',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `reminder-${habit.id}`,
      renotify: true,
      requireInteraction: false,
      data: { habitId: habit.id, url: '/' },
    });
    scheduleReminder(habit);
  }, delay);

  scheduledTimers.set(habit.id, timerId);
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_REMINDERS') {
    const habits = event.data.habits || [];
    for (const [id] of scheduledTimers) {
      if (!habits.find((h) => h.id === id)) {
        clearTimeout(scheduledTimers.get(id));
        scheduledTimers.delete(id);
      }
    }
    habits.forEach((h) => scheduleReminder(h));
  }
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
