/** Monitoramento opcional (Sentry via CDN ou SDK embutido). */
export function captureException(error, context = {}) {
  try {
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(error, { extra: context });
      return;
    }
  } catch {
    // ignore
  }
  if (import.meta.env.DEV) {
    console.error("[monitoring]", error, context);
  }
}

export function captureMessage(message, level = "info") {
  try {
    if (typeof window !== "undefined" && window.Sentry?.captureMessage) {
      window.Sentry.captureMessage(message, level);
    }
  } catch {
    // ignore
  }
}
