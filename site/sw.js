'use strict';
const CACHE = 'pc-wake-shell-v5-remote-start-auto-update';
const ROOT = new URL('./', self.location.href);
const SHELL_PATHS = ['./', './index.html', './style.css', './state.js', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png', './icons/apple-touch-icon.png'];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, ROOT).href);
const SHELL_SET = new Set(SHELL_URLS);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('pc-wake-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never intercept API requests, authenticated requests, or backend configuration.
  if (request.method !== 'GET' || request.headers.has('Authorization') || url.origin !== ROOT.origin || url.pathname.endsWith('/config.js') || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate' && url.pathname.startsWith(ROOT.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('./index.html', ROOT).href)));
    return;
  }
  url.search = ''; url.hash = '';
  if (!SHELL_SET.has(url.href)) return;
  event.respondWith(caches.match(url.href).then(cached => cached || fetch(request)));
});
