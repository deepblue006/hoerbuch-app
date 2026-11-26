/* Sorgt dafür, dass die App ohne Internet startet: Die Programmdateien liegen in einem Zwischenspeicher.
   Die Hörbücher selbst liegen nicht hier, sondern in der Datenbank der App.
   Die Seite selbst wird zuerst frisch geholt (damit Verbesserungen sofort ankommen);
   ohne Netz oder nach 3 Sekunden ohne Antwort kommt sie aus dem Zwischenspeicher. */
const VERSION = 'hoerbuch-v4';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fresh(req, cache) {
  return fetch(req, { cache: 'no-cache' }).then(resp => {
    if (resp.ok && resp.status === 200) cache.put(req, resp.clone());
    return resp;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (req.mode === 'navigate') {
      const net = fresh(req, cache).catch(() => null);
      const timeout = new Promise(r => setTimeout(() => r(null), 3000));
      const resp = await Promise.race([net, timeout]);
      if (resp) return resp;
      const hit = await cache.match(req, { ignoreSearch: true }) || await cache.match('index.html') || await cache.match('./');
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || Response.error();
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fresh(req, cache).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
