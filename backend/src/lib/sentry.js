let Sentry = null;

function sentryDsn() {
  return (process.env.SENTRY_DSN || "").trim();
}

export function isSentryConfigured() {
  return Boolean(sentryDsn());
}

export function isSentryActive() {
  return Boolean(Sentry);
}

export async function initSentry() {
  const dsn = sentryDsn();
  if (!dsn) return false;

  try {
    const mod = await import("@sentry/node");
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    Sentry = mod;
    return true;
  } catch (err) {
    console.warn("[sentry] falha ao iniciar:", err?.message || err);
    Sentry = null;
    return false;
  }
}

export function captureException(error, context = {}) {
  if (!Sentry || !error) return;
  try {
    const extra =
      context && Object.keys(context).length ? { extra: context } : undefined;
    Sentry.captureException(error, extra);
  } catch {
    /* não quebrar o request se o Sentry falhar */
  }
}

export function captureMessage(message, level = "info") {
  if (!Sentry || !message) return;
  try {
    Sentry.captureMessage(String(message), level);
  } catch {
    /* ignore */
  }
}

export async function closeSentry() {
  if (!Sentry?.close) return;
  try {
    await Sentry.close(2000);
  } catch {
    /* ignore */
  }
}
