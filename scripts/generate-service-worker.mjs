import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'

const dist = new URL('../dist/', import.meta.url)
const root = dist.pathname
async function gather(dir) {
  const found = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name)
    if (e.isDirectory()) found.push(...await gather(path))
    else if (!/\.map$/.test(e.name) && !/\.glb$/.test(e.name) && e.name !== 'sw.js') found.push('/' + relative(root, path).replaceAll('\\', '/'))
  }
  return found
}
const files = [...new Set(['/', ...(await gather(root))])].sort()
// A content fingerprint gives each deployment its own shell cache. GitHub Pages
// serves multiple projects on one origin, so this game must not purge their caches.
const fingerprint = createHash('sha256')
for (const path of files) {
  fingerprint.update(path)
  if (path !== '/') fingerprint.update(await readFile(join(root, path.slice(1))))
}
const cacheVersion = fingerprint.digest('hex').slice(0, 12)
// Cache entrypoint and generated hashed JS/CSS so the install is launchable offline.
const worker = `/* ANIK Block Racers Samsung Galaxy Edition: PWA offline worker */
const CACHE_PREFIX = 'anik-block-racers-';
const SHELL = CACHE_PREFIX + 'shell-${cacheVersion}';
const GAME_ASSETS = CACHE_PREFIX + 'model-v2';
const MODEL = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xFRdnQaeZpG4RsfN9xIl0GlMG/a39fc13c-8c8d-49e0-aeb1-aa21216a6228.glb';
const BASE = new URL(self.registration.scope).pathname;
const PRECACHE = ${JSON.stringify(files, null, 2)}.map(path => BASE + path.slice(1));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && ![SHELL, GAME_ASSETS].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
    // First-page GLB loading may happen before the worker takes control.
    // Warm it once so a subsequent launch can work without a network.
    try {
      const cache = await caches.open(GAME_ASSETS);
      if (!(await cache.match(MODEL))) {
        const response = await fetch(MODEL, { mode: 'cors' });
        if (response.ok) await cache.put(MODEL, response.clone());
      }
    } catch (_) { /* Offline until the next successful online race. */ }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The original Higgsfield GLB is CORS-readable; cache it after first successful play.
  if (url.origin !== self.location.origin) {
    if (url.href !== MODEL) return; // Never cache unrelated cross-origin models.
    event.respondWith(caches.open(GAME_ASSETS).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
      return response;
    }));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) { const cache = await caches.open(SHELL); await cache.put(BASE, response.clone()); }
      return response;
    }).catch(async () => (await caches.match(BASE)) || (await caches.match(BASE + 'index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
    if (response.ok && url.origin === self.location.origin) {
      const cache = await caches.open(SHELL); await cache.put(request, response.clone());
    }
    return response;
  })));
});
`;
await writeFile(new URL('../dist/sw.js', import.meta.url), worker)
console.log(`Offline service worker generated; ${files.length} shell files included.`)
