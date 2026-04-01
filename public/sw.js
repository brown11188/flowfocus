const VERSION = "flowfocus-pwa-v2";
const STATIC_CACHE = `${VERSION}:static`;
const RUNTIME_CACHE = `${VERSION}:runtime`;
const SW_PATH = self.location.pathname;
const BASE_PATH = SW_PATH.endsWith("/sw.js") ? SW_PATH.slice(0, -6) : "";
const OFFLINE_URL = `${BASE_PATH}/offline.html`;
const STATIC_ASSETS = [
  OFFLINE_URL,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon.svg`,
  `${BASE_PATH}/icon-maskable.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ------------------------------------------------------------------ */
/*  Notification click — deep-link into the app                        */
/* ------------------------------------------------------------------ */
self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification.data?.url;
  event.notification.close();

  if (!targetUrl) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window with the same URL
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise navigate the first available window
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Last resort: open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

function isCacheableAsset(pathname) {
  return (
    pathname.startsWith(`${BASE_PATH}/_next/static/`) ||
    pathname === `${BASE_PATH}/manifest.json` ||
    pathname === `${BASE_PATH}/icon.svg` ||
    pathname === `${BASE_PATH}/icon-maskable.svg` ||
    pathname === `${BASE_PATH}/offline.html` ||
    /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE_PATH}/api/`)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cachedPage = await caches.match(request);
          return cachedPage || caches.match(OFFLINE_URL);
        }
      })(),
    );
    return;
  }

  if (!isCacheableAsset(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        void fetch(request)
          .then(async (response) => {
            if (!response.ok) return;
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
          })
          .catch(() => undefined);
        return cached;
      }

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
