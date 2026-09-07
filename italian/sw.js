const CACHE_NAME = "italian-verb-sprint-v7";

self.addEventListener("install", (event) => {
  const scope = new URL(self.registration.scope);
  const appShell = [scope.href, new URL("index.html", scope).href, new URL("manifest.webmanifest", scope).href];
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(appShell)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const scope = new URL(self.registration.scope);
  const url = new URL(event.request.url);
  // API responses and external resources must never enter the app-shell cache.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.pathname.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && event.request.mode !== "navigate") return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached || (event.request.mode === "navigate" ? caches.match(new URL("index.html", scope).href) : Response.error()));
    }),
  );
});
