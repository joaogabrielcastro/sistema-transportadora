/**
 * Detecta deploy novo sem depender do service worker.
 */
import { purgePwaStorage } from "./utils/serviceWorkerCleanup.js";
const POLL_MS = 15_000;
const STORAGE_KEY = "atrack_build_id";
const RELOAD_GUARD = "atrack_boot_reload";

function currentBuildId() {
  return typeof __ATRACK_BUILD_ID__ !== "undefined"
    ? String(__ATRACK_BUILD_ID__)
    : "";
}

async function fetchRemoteBuildId() {
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.buildId ? String(data.buildId) : null;
}

export async function forceAppReload() {
  try {
    if (sessionStorage.getItem(RELOAD_GUARD) === "1") {
      sessionStorage.removeItem(RELOAD_GUARD);
    } else {
      sessionStorage.setItem(RELOAD_GUARD, "1");
    }
  } catch {
    /* ignore */
  }

  try {
    await purgePwaStorage();
  } catch {
    /* ainda recarrega */
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_atrack", Date.now().toString(36));
  window.location.replace(url.toString());
}

function notifyUpdateAvailable(remoteId) {
  window.dispatchEvent(
    new CustomEvent("atrack:update-available", {
      detail: { buildId: remoteId },
    }),
  );
  // Qualquer tela: atualiza sozinho (antes só login fazia isso)
  void forceAppReload();
}

export function initVersionWatch() {
  if (!import.meta.env.PROD) return;

  try {
    if (sessionStorage.getItem(RELOAD_GUARD) === "1") {
      sessionStorage.removeItem(RELOAD_GUARD);
    }
  } catch {
    /* ignore */
  }

  const localId = currentBuildId();
  if (!localId) return;

  try {
    localStorage.setItem(STORAGE_KEY, localId);
  } catch {
    /* ignore */
  }

  let checking = false;

  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const remoteId = await fetchRemoteBuildId();
      if (!remoteId) return;

      // Compara JS embutido E o que ficou salvo da visita anterior
      let stored = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }

      if (remoteId === localId) {
        if (stored && stored !== remoteId) {
          try {
            localStorage.setItem(STORAGE_KEY, remoteId);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      notifyUpdateAvailable(remoteId);
    } catch {
      /* rede offline — ignora */
    } finally {
      checking = false;
    }
  };

  void check();
  window.setInterval(check, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("focus", () => {
    void check();
  });
}
