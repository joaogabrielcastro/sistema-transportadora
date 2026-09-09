/** LID público da oferta = id do catálogo (starter | fiscal | complete). */

export const SELECTED_LID_STORAGE_KEY = "atrack_selected_lid";

export const PUBLIC_PLAN_LIDS = Object.freeze(["starter", "fiscal", "complete"]);

export const PLAN_UNAVAILABLE_MESSAGE =
  "Este plano não está disponível para contratação. Escolha um plano válido na página de planos.";

export function normalizeLid(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isValidPublicLid(value) {
  const lid = normalizeLid(value);
  return PUBLIC_PLAN_LIDS.includes(lid);
}

export function persistSelectedLid(value) {
  const lid = normalizeLid(value);
  if (!isValidPublicLid(lid) || typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    sessionStorage.setItem(SELECTED_LID_STORAGE_KEY, lid);
  } catch {
    /* private mode */
  }
  return lid;
}

export function readStoredLid() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const lid = normalizeLid(sessionStorage.getItem(SELECTED_LID_STORAGE_KEY) || "");
    return isValidPublicLid(lid) ? lid : null;
  } catch {
    return null;
  }
}

export function clearStoredLid() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SELECTED_LID_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve o LID a partir da URL (query ou slug) e da sessão.
 * LID inválido na URL não quebra o fluxo — devolve erro amigável.
 */
export function resolveSelectedLid({ searchLid, pathLid } = {}) {
  const fromUrl = normalizeLid(pathLid || searchLid || "");
  if (fromUrl) {
    if (isValidPublicLid(fromUrl)) {
      persistSelectedLid(fromUrl);
      return { lid: fromUrl, invalid: false };
    }
    return {
      lid: null,
      invalid: true,
      message: PLAN_UNAVAILABLE_MESSAGE,
    };
  }
  const stored = readStoredLid();
  return { lid: stored, invalid: false };
}

export function registerHref(lid) {
  const normalized = normalizeLid(lid);
  return isValidPublicLid(normalized)
    ? `/register?lid=${encodeURIComponent(normalized)}`
    : "/register";
}

export function assinaturaHref(lid) {
  const normalized = normalizeLid(lid);
  return isValidPublicLid(normalized)
    ? `/assinatura?lid=${encodeURIComponent(normalized)}`
    : "/assinatura";
}

export function planosHref(lid) {
  const normalized = normalizeLid(lid);
  if (isValidPublicLid(normalized)) return `/planos/${encodeURIComponent(normalized)}`;
  return "/planos";
}

/** CTA comercial: cadastro (público) ou checkout autenticado. */
export function planCtaHref({ lid, isAuthenticated, registerEnabled }) {
  if (isAuthenticated) return assinaturaHref(lid);
  if (registerEnabled === false) return "/login";
  return registerHref(lid);
}
