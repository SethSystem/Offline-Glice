const CACHE_NAME = 'habitflow-v2';
const ASSETS_TO_CACHE = ['/', '/index.html', '/favicon.svg', '/manifest.json'];

// ── Reminder scheduling ──────────────────────────────────────────────────────
const scheduledTimers = new Map(); // habitId → timerId

function scheduleReminder(habit) {
  // Clear existing timer for this habit
  if (scheduledTimers.has(habit.id)) {
    clearTimeout(scheduledTimers.get(habit.id));
    scheduledTimers.delete(habit.id);
  }

  if (!habit.reminderTime) return;

  const [hours, minutes] = habit.reminderTime.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  // If time already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  const timerId = setTimeout(async () => {
    scheduledTimers.delete(habit.id);

    // Fire the notification
    await self.registration.showNotification(`${habit.icon} ${habit.name}`, {
      body: 'Hora de marcar esse hábito como concluído! ✅',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `reminder-${habit.id}`,
      renotify: true,
      requireInteraction: false,
      data: { habitId: habit.id, url: '/' },
      actions: [
        { action: 'open', title: 'Abrir app' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
    });

    // Reschedule for the next day
    scheduleReminder(habit);
  }, delay);

  scheduledTimers.set(habit.id, timerId);
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch (network-first with cache fallback) ────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (event.request.url.startsWith('http')) cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Messages from app ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_REMINDERS') {
    const habits = event.data.habits || [];
    // Cancel removed habits
    for (const [id] of scheduledTimers) {
      if (!habits.find((h) => h.id === id)) {
        clearTimeout(scheduledTimers.get(id));
        scheduledTimers.delete(id);
      }
    }
    // Schedule each habit that has a reminderTime
    habits.forEach((h) => scheduleReminder(h));
  }
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
        return;
      }
      return self.clients.openWindow('/');
    })
  );
});
