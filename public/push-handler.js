// Imported into the generated service worker (see vite.config.ts -> workbox.importScripts).
// The push carries no payload: it only tells the app that a question can be asked.

function readLang() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('corpus-app');
      open.onerror = () => resolve('tr');
      open.onsuccess = () => {
        try {
          const db = open.result;
          const req = db.transaction('settings').objectStore('settings').get('app');
          req.onsuccess = () => {
            db.close();
            resolve(req.result && req.result.lang === 'en' ? 'en' : 'tr');
          };
          req.onerror = () => resolve('tr');
        } catch {
          resolve('tr');
        }
      };
    } catch {
      resolve('tr');
    }
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    readLang().then((lang) =>
      self.registration.showNotification('Corpus', {
        body: lang === 'en' ? 'A question is waiting for you' : 'Bir soru seni bekliyor',
        tag: 'corpus-prompt',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        silent: true,
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./?prompt=1', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'corpus-prompt' });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
