/** Monitoramento opcional via Sentry. Sem VITE_SENTRY_DSN, não carrega o SDK. */

let sentryMod = null;
let initPromise = null;

export function isSentryConfigured() {
  return Boolean(import.meta.env.VITE_SENTRY_DSN);
}

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return false;
  if (sentryMod) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const Sentry = await import("@sentry/react");
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0,
      });
      sentryMod = Sentry;
      window.Sentry = Sentry;
      return true;
    } catch (err) {
      console.warn("[monitoring] Sentry init failed", err);
      sentryMod = null;
      return false;
    }
  })();

  return initPromise;
}

export function captureException(error, context = {}) {
  try {
    if (sentryMod?.captureException) {
      sentryMod.captureException(error, { extra: context });
      return;
    }
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(error, { extra: context });
      return;
    }
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    console.error("[monitoring]", error, context);
  }
}

export function captureMessage(message, level = "info") {
  try {
    if (sentryMod?.captureMessage) {
      sentryMod.captureMessage(message, level);
      return;
    }
    if (typeof window !== "undefined" && window.Sentry?.captureMessage) {
      window.Sentry.captureMessage(message, level);
    }
  } catch {
    /* ignore */
  }
}
