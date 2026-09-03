/**
 * Remove service workers sem cancelar navigation preload abruptamente.
 */
export async function unregisterAllServiceWorkers() {
  if (!("serviceWorker" in navigator)) return false;

  const regs = await navigator.serviceWorker.getRegistrations();
  if (!regs.length) return false;

  await Promise.all(
    regs.map(async (reg) => {
      try {
        if (reg.navigationPreload) {
          await reg.navigationPreload.disable();
        }
      } catch {
        /* ignore */
      }
      try {
        await reg.unregister();
      } catch {
        /* ignore */
      }
    }),
  );

  return true;
}

export async function clearAllCaches() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
}

export async function purgePwaStorage() {
  const hadWorkers = await unregisterAllServiceWorkers();
  await clearAllCaches();
  return hadWorkers;
}
