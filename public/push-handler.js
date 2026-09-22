// Imported into the generated service worker (see vite.config.ts -> workbox.importScripts).
// A push carries no payload: it only says "now". What to show is chosen here, from what the app stored
// in IndexedDB, so no entry ever passes through the push server.

const DB_NAME = 'corpus';

const FALLBACK = [
  { tr: 'Seni dinledim. Daha da dinleyeceğim.', en: 'I listened. I will keep listening.' },
  { tr: 'Yazdığın her şey yerinde duruyor. Hiçbiri kaybolmadı.', en: 'Everything you wrote is where you left it. Nothing was lost.' },
  { tr: 'Bir şey yazmana gerek yok. Corpus zaten düşünüyor.', en: 'You do not have to write anything. Corpus is already thinking.' },
  { tr: 'Dağınık olanı ben topluyorum. Sen hayatına devam et.', en: 'I am gathering the scattered parts. Go on with your day.' },
  { tr: 'Bugün tek bir cümle bile yeter. Gerisini ben bağlarım.', en: 'One sentence is enough today. I will connect the rest.' },
  { tr: 'Notların birbirini buldu. Merak edersen bak.', en: 'Your notes found each other. Take a look if you are curious.' },
  { tr: 'Unutmana izin var. Ben unutmuyorum.', en: 'You are allowed to forget. I am not.' },
  { tr: 'Kafandaki gürültü burada yavaşça bir metne dönüşüyor.', en: 'The noise in your head is slowly turning into a text here.' },
  { tr: 'Bir sonraki essay çoktan yazılmaya başladı. Sessizce.', en: 'The next essay has already started writing itself. Quietly.' },
  { tr: 'Hiçbir fikrin küçük değil. Hepsi arşivde, hepsi yerinde.', en: 'None of your ideas is small. All of them are archived, all in place.' },
];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll(db, store) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function get(db, store, key) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function put(db, store, value) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function localDay(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function questionText(record, lang) {
  const text = record.i18n ? record.i18n[lang] || record.i18n.tr : record;
  return text ? text.question : '';
}

async function choose() {
  const now = new Date();
  let db;
  try {
    db = await openDb();
  } catch {
    return { kind: 'listen', body: pick(FALLBACK).tr };
  }
  const settings = (await get(db, 'settings', 'app')) || {};
  const lang = settings.lang === 'en' ? 'en' : 'tr';
  const notify = settings.notify || { listen: 2, questions: 1, morning: true };
  const today = localDay(now);
  const meta = (await get(db, 'notes', 'meta')) || { id: 'meta', kind: 'meta' };
  if (meta.day !== today) Object.assign(meta, { day: today, questions: 0, morning: false });

  const notes = await getAll(db, 'notes');
  const soon = now.getTime() + 5 * 60 * 1000;
  let result;

  const echo = notes
    .filter((n) => n.kind === 'echo' && !n.usedAt && n.dueAt && new Date(n.dueAt).getTime() <= soon)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const morningNote = notes.find((n) => n.id === 'morning');

  if (echo) {
    echo.usedAt = now.toISOString();
    await put(db, 'notes', echo);
    result = { kind: 'echo', body: echo.body[lang] };
  } else if (notify.morning && !meta.morning && now.getHours() < 12 && morningNote) {
    meta.morning = true;
    result = { kind: 'morning', body: morningNote.body[lang] };
  } else if ((meta.questions || 0) < notify.questions) {
    const prompts = (await getAll(db, 'prompts')).filter((p) => p.status === 'pending');
    const followups = (await getAll(db, 'followups')).filter((f) => f.status === 'pending');
    const q = prompts[0] || followups[0];
    if (q) {
      meta.questions = (meta.questions || 0) + 1;
      result = { kind: 'question', body: questionText(q, lang) };
    }
  }

  if (!result) {
    const listen = notes.filter((n) => n.kind === 'listen' && !n.usedAt);
    if (listen.length > 0) {
      const note = pick(listen);
      note.usedAt = now.toISOString();
      await put(db, 'notes', note);
      result = { kind: 'listen', body: note.body[lang] };
    } else {
      result = { kind: 'listen', body: pick(FALLBACK)[lang] };
    }
  }

  await put(db, 'notes', meta);
  db.close();
  return result;
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    choose().then((note) =>
      self.registration.showNotification('Corpus', {
        body: note.body,
        tag: `corpus-${note.kind}`,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { kind: note.kind },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const isQuestion = event.notification.data && event.notification.data.kind === 'question';
  const target = new URL(isQuestion ? './?prompt=1' : './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (isQuestion) client.postMessage({ type: 'corpus-prompt' });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
