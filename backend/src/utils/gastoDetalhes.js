import { FIELD_LIMITS } from "./fieldLimits.js";
import { normalizeTipoGastoName } from "./tiposGastosCatalog.js";

export const STATUS_PAGAMENTO_GASTO = Object.freeze([
  "pago",
  "pendente",
  "em_recurso",
  "cancelado",
]);

/**
 * Classifica o tipo de gasto pelo nome cadastrado (catálogo + customizados).
 * @param {string} nomeTipo
 * @returns {string}
 */
export function classifyTipoGasto(nomeTipo) {
  const n = normalizeTipoGastoName(nomeTipo);
  if (n.includes("multa")) return "multa";
  if (n.includes("pedagio")) return "pedagio";
  if (n.includes("combust")) return "combustivel";
  if (n.includes("seguro")) return "seguro";
  if (n.includes("ipva") || n.includes("licenci")) return "ipva";
  if (n.includes("salario") || n.includes("diaria")) return "salario";
  if (n.includes("aliment")) return "alimentacao";
  if (n.includes("hosped")) return "hospedagem";
  if (n.includes("estacion")) return "estacionamento";
  if (n.includes("lavagem")) return "lavagem";
  if (n.includes("peca")) return "pecas";
  return "outros";
}

/**
 * Limpa o JSON de detalhes do gasto: só chaves/valores curtos, sem aninhar.
 * @param {unknown} raw
 * @returns {Record<string, string | number | boolean> | null}
 */
export function sanitizeGastoDetalhes(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const out = {};
  const entries = Object.entries(raw).slice(0, 24);
  for (const [keyRaw, value] of entries) {
    const key = String(keyRaw || "")
      .trim()
      .slice(0, FIELD_LIMITS.GASTO_DETALHE_KEY);
    if (!key) continue;
    if (value == null || value === "") continue;
    if (typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
      continue;
    }
    const text = String(value).trim();
    if (!text) continue;
    out[key] = text.slice(0, FIELD_LIMITS.GASTO_DETALHE_VALOR);
  }

  return Object.keys(out).length ? out : null;
}
