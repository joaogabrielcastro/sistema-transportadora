/**
 * O ATrack é um SaaS online: PWA/offline atrapalhava (tela antiga até hard refresh).
 * Esta rotina só DESREGISTRA service workers e limpa Cache Storage.
 */
import { forceAppReload } from "./versionWatch.js";

export function initPwaAutoUpdate() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_atrack_sw") || url.searchParams.has("_atrack")) {
      url.searchParams.delete("_atrack_sw");
      url.searchParams.delete("_atrack");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    /* ignore */
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event?.data?.type === "ATRACK_FORCE_RELOAD") {
      void forceAppReload();
    }
  });

  void (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) return;

      await Promise.all(regs.map((r) => r.unregister()));

      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // Uma vez: recarrega para sair do HTML/JS que o SW antigo estava segurando
      const flag = "atrack_sw_cleared";
      if (sessionStorage.getItem(flag) !== "1") {
        sessionStorage.setItem(flag, "1");
        const next = new URL(window.location.href);
        next.searchParams.set("_atrack", Date.now().toString(36));
        window.location.replace(next.toString());
      }
    } catch {
      /* ignore */
    }
  })();
}
