const CACHE_NAME = "wody-v2";
const STATIC_ASSETS = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/apple-touch-icon.png",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — only cache static assets, let Next.js handle navigation
self.addEventListener("fetch", (event) => {
  // Only handle GET requests for static assets we explicitly cache
  if (
    event.request.method !== "GET" ||
    event.request.mode === "navigate" ||
    event.request.headers.get("RSC") ||
    event.request.headers.get("Next-Router-State-Tree") ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("/auth/") ||
    event.request.url.includes("/_next/")
  ) {
    return;
  }

  // Only intercept requests for cached static assets
  const isStaticAsset =
    event.request.url.includes("/icons/") ||
    event.request.url.includes("apple-touch-icon");

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || fetch(event.request))
      )
  );
});
