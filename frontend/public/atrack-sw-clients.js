/**
 * Legado: mesmo comportamento de /sw.js para clientes com SW antigo neste path.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* ignore */
        }
      }

      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }

      try {
        await self.registration.unregister();
      } catch {
        /* ignore */
      }

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        try {
          client.postMessage({ type: "ATRACK_FORCE_RELOAD" });
        } catch {
          /* ignore */
        }
      }
    })(),
  );
});
