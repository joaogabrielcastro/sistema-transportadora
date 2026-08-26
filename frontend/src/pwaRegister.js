/**
 * Impede o PWA de ficar preso na versão antiga:
 * procura update ao abrir/voltar e recarrega quando a versão nova assume.
 */
import { registerSW } from "virtual:pwa-register";
import { forceAppReload } from "./versionWatch.js";

const POLL_MS = 60_000;
let reloading = false;

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

export function initPwaAutoUpdate() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  // Limpa params de reload forçado (SW / bootstrap) da barra de endereço
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

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event?.data?.type === "ATRACK_FORCE_RELOAD") {
      void forceAppReload();
    }
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
      window.dispatchEvent(new CustomEvent("atrack:update-available"));
    },
    onOfflineReady() {
      /* ok */
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      const check = () => {
        void registration.update().catch(() => {});
      };

      check();
      window.setInterval(check, POLL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("focus", check);
    },
    onRegisterError() {
      // Se o SW falhar, ainda dá para forçar limpeza quando houver versão nova
      window.addEventListener("atrack:update-available", () => {
        void forceAppReload();
      });
    },
  });
}
