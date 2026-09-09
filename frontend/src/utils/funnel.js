import { captureMessage } from "../lib/monitoring.js";

/**
 * Eventos de funil comercial. Só envia lid (identificador público), nunca PII.
 * Preserva dataLayer se existir (GTM/GA).
 */
export function trackFunnel(event, props = {}) {
  if (!event) return;
  const payload = { event, ...props };
  try {
    if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(payload);
    }
  } catch {
    /* ignore */
  }
  try {
    captureMessage(`[funnel] ${event}`, "info");
  } catch {
    /* ignore */
  }
}
