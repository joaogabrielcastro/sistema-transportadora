/**
 * SW suicida: ao ativar, limpa caches, desregistra e manda as abas recarregarem.
 * Quebra o ciclo de clientes presos na versão antiga do PWA.
 */
/* eslint-disable no-restricted-globals */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
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

      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.navigate(client.url);
          } catch {
            try {
              client.postMessage({ type: "ATRACK_FORCE_RELOAD" });
            } catch {
              /* ignore */
            }
          }
        }),
      );
    })(),
  );
});
