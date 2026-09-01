/**
 * Substitui o Workbox antigo: desliga preload, limpa cache e se desregistra.
 * Não intercepta fetch (sem listener) — evita app preso em versão antiga.
 */
/* eslint-disable no-restricted-globals */
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
