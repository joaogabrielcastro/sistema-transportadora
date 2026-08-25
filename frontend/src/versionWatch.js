/**
 * Detecta deploy novo sem depender só do service worker.
 * Compara o build embutido no JS com /version.json (sempre sem cache).
 */
const POLL_MS = 60_000;
const STORAGE_KEY = "atrack_build_id";

function currentBuildId() {
  return typeof __ATRACK_BUILD_ID__ !== "undefined"
    ? String(__ATRACK_BUILD_ID__)
    : "";
}

async function fetchRemoteBuildId() {
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.buildId ? String(data.buildId) : null;
}

export async function forceAppReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
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
  // Na tela de login, atualiza sozinho (não perde formulário de trabalho)
  const path = window.location.pathname || "";
  if (path === "/login" || path === "/register") {
    void forceAppReload();
  }
}

export function initVersionWatch() {
  if (!import.meta.env.PROD) return;
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
      if (!remoteId || remoteId === localId) return;
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
