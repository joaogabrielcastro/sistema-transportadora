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

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
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
