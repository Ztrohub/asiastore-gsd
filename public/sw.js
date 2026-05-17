const SHELL_CACHE = "asiatek-shell-v1";
const SHELL_ASSETS = ["/", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cachedPage = await caches.match(request);
        if (cachedPage) {
          return cachedPage;
        }

        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cachedRoot = await caches.match("/");
          if (cachedRoot) {
            return cachedRoot;
          }

          const cachedOffline = await caches.match("/offline");
          return cachedOffline ?? Response.error();
        }
      })().catch(async () => {
        const cachedRoot = await caches.match("/");
        if (cachedRoot) {
          return cachedRoot;
        }
        const cachedOffline = await caches.match("/offline");
        return cachedOffline ?? Response.error();
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/api/auth/login") ||
    url.pathname.startsWith("/api/auth/session") ||
    url.pathname.startsWith("/api/auth/logout")
  ) {
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.type === "opaqueredirect") {
            return response;
          }
          const cloned = response.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(() => caches.match("/offline"));
    }),
  );
});
