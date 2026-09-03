/** Versão gravada no aceite. Manter alinhada com backend/src/utils/legal.js */
export const LEGAL_VERSION = "2026-09-02";
export const LEGAL_EFFECTIVE_LABEL = "2 de setembro de 2026";

const viteLegalEmail =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_LEGAL_CONTACT_EMAIL
    : "";

export const LEGAL_CONTACT_EMAIL = String(viteLegalEmail || "").trim();

export function legalContactLabel() {
  return LEGAL_CONTACT_EMAIL
    ? LEGAL_CONTACT_EMAIL
    : "o canal de suporte da operação ATrack";
}
