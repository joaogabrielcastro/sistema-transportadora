/**
 * O ATrack é SaaS online — sem PWA/offline.
 * Desliga navigation preload antes de remover SW (evita warning no console).
 */
import { forceAppReload } from "./versionWatch.js";
import { purgePwaStorage } from "./utils/serviceWorkerCleanup.js";

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
      const hadWorkers = await purgePwaStorage();
      if (!hadWorkers) return;

      const flag = "atrack_sw_cleared";
      if (sessionStorage.getItem(flag) === "1") return;
      sessionStorage.setItem(flag, "1");
      const next = new URL(window.location.href);
      next.searchParams.set("_atrack", Date.now().toString(36));
      window.location.replace(next.toString());
    } catch {
      /* ignore */
    }
  })();
}
