/** Valores canônicos usados em caminhoes.empresa / notas / gastos. */
export const EMPRESAS_FROTA = Object.freeze([
  "Solofino",
  "Colombocal",
  "Transmotin",
]);

export const EMPRESAS_FROTA_SET = new Set(
  EMPRESAS_FROTA.map((e) => e.toLowerCase()),
);

/**
 * Normaliza texto livre para um dos valores canônicos, ou null.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeEmpresaFrota(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;

  const compact = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (compact.includes("transmotin") || compact.includes("motin")) {
    return "Transmotin";
  }
  if (compact.includes("colombocal") || compact.includes("pedreira")) {
    return "Colombocal";
  }
  if (compact.includes("solofino")) {
    return "Solofino";
  }

  const lower = s.toLowerCase();
  const hit = EMPRESAS_FROTA.find((e) => e.toLowerCase() === lower);
  return hit || null;
}
