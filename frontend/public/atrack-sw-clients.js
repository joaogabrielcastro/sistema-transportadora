/**
 * Roda no service worker (importScripts).
 * Em deploy novo, força as abas abertas a recarregarem pela rede —
 * assim o cliente não precisa de hard refresh para ver botões novos (ex.: Ver).
 */
/* eslint-disable no-restricted-globals */
let replacingPrevious = false;

self.addEventListener("install", () => {
  // Se já havia um SW ativo, esta instalação é um update
  replacingPrevious = Boolean(self.registration.active);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {
        /* ignore */
      }

      if (!replacingPrevious) return;

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
