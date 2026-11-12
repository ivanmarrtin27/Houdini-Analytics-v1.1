/* Houdini Analytics service worker.
 *
 * Strategy
 * - App shell (html/js/css/icons): stale-while-revalidate ? fast offline boot
 *   and a background refresh on every load.
 * - API GETs: network-first with a short TTL, cached copy as offline fallback.
 * - Admin and sync endpoints are never cached.
 * - Anything else is passed straight through to the network.
 *
 * Bump VERSION (and the ?v= query of the shell assets in index.html) whenever
 * the shell changes, so clients pick the new files.
 */

const VERSION = 'hb-v180';
const SHELL_CACHE = `houdini-shell-${VERSION}`;
const DATA_CACHE = `houdini-data-${VERSION}`;
const DATA_TTL_MS = 60_000;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js?v=hb180',
  '/styles.css?v=hb180',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-48.png',
  '/icons/ui/partidos.png',
  '/icons/ui/top10.png',
  '/icons/ui/aciertos.png',
  '/icons/ui/ligas.png',
  '/icons/ui/premium-crown.png',
  '/icons/ui/btts.png',
  '/icons/ui/goals.png',
  '/icons/ui/cards.png',
  '/brand/houdini-analytics-mark.png',
  '/brand/houdini-analytics-icon.png',
  '/brand/houdini-analytics-lockup.png',
  '/brand/og-share.png',
];

const NEVER_CACHE = ['/api/v1/admin', '/api/v1/sync'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One by one: a single missing asset must not break the whole install.
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) await cache.put(url, res.clone());
          } catch (_) {
            /* offline at install time: the fetch will succeed later */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('houdini-') && key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** The Worker serves index.html for unknown paths; never cache that as an asset. */
function looksLikeSpaFallback(response) {
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function isApi(url) {
  return url.pathname.startsWith('/api/');
}

function isNeverCached(url) {
  return NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix));
}

function isShellAsset(url) {
  return (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    /\.(?:js|css|png|svg|webmanifest|woff2?|ico)$/.test(url.pathname)
  );
}

async function networkFirstApi(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) {
      // Mark it so the UI can tell the data is a cached copy.
      const headers = new Headers(cached.headers);
      headers.set('x-houdini-cache', 'offline');
      return new Response(await cached.blob(), {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(
      JSON.stringify({ error: 'Sin conexiÃ³n y sin copia guardada de esta consulta.' }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
    );
  }
}

/** Prefer network for versioned app shell JS/CSS so deploys are not stuck on SWR stale. */
async function networkFirstShellScript(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request, { cache: 'reload' });
    if (res && res.ok && !looksLikeSpaFallback(res)) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function isCriticalShellScript(url) {
  return (
    url.pathname === '/app.js' ||
    url.pathname === '/styles.css' ||
    url.pathname === '/sw.js'
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res && res.ok && !looksLikeSpaFallback(res)) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);
  if (cached) return cached;
  const res = await network;
  if (res) return res;
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/index.html', res.clone());
    }
    return res;
  } catch (_) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match('/index.html');
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Sin conexiÃ³n</title>' +
        '<body style="font-family:system-ui;background:#0a0a0a;color:#f5f5f5;padding:2rem">' +
        '<h1 style="font-size:1.2rem">Sin conexiÃ³n</h1>' +
        '<p>Vuelve a intentarlo cuando recuperes la red.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCached(url)) return;

  if (isApi(url)) {
    event.respondWith(networkFirstApi(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isCriticalShellScript(url)) {
    event.respondWith(networkFirstShellScript(request));
    return;
  }
  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
