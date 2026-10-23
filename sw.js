// 离线缓存：打开时优先取最新版本（2.5 秒内拿不到就用缓存），没网也能用
const CACHE = 'fitlog-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage) {
    const net = fetch(req).then(async (res) => {
      if (res.ok) {
        const c = await caches.open(CACHE);
        await c.put('./index.html', res.clone());
      }
      return res;
    });
    e.waitUntil(net.then(() => {}, () => {}));
    e.respondWith((async () => {
      const cached = await caches.match('./index.html');
      if (!cached) return net;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
      try {
        const res = await Promise.race([net, timeout]);
        return res && res.ok ? res : cached;
      } catch (err) {
        return cached;
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
