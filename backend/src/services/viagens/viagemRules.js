import { PERMISSIONS, hasPermission } from "../../utils/permissions.js";

/**
 * Regras puras do módulo de viagens (sem banco): cálculos, visibilidade de
 * campos financeiros e diferenças para o histórico.
 */

/** Tolerância para horários informados um pouco à frente do relógio do servidor. */
export const FUTURE_TOLERANCE_MS = 15 * 60_000;
/** Despesa pode ter sido feita até 24 h antes da saída (ex.: abastecimento na véspera). */
export const DESPESA_ANTES_SAIDA_MS = 24 * 60 * 60_000;

export const STATUS_LABEL = Object.freeze({
  planejada: "Planejada",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
});

/** O que o usuário pode ver nas respostas do módulo. */
export function viagemVisibility(permissions) {
  return {
    financeiro: hasPermission(permissions, PERMISSIONS.VIAGENS_FINANCEIRO),
    despesas: hasPermission(permissions, PERMISSIONS.VIAGENS_DESPESAS_READ),
  };
}

export function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.status = statusCode;
  if (code) err.code = code;
  return err;
}

/** Exige permissão dentro do serviço (além da rota), para regras compostas. */
export function assertPermission(permissions, required, message) {
  if (!hasPermission(permissions, required)) {
    throw httpError(message || "Sem permissão para esta operação", 403, "FORBIDDEN");
  }
}

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Indicadores calculados de uma viagem.
 * @param {{ status: string, saida_em: Date|string, chegada_em?: Date|string|null, km_inicial: number, km_final?: number|null }} v
 * @param {number} totalDespesas soma dos valores das despesas
 */
export function viagemIndicadores(v, totalDespesas = 0) {
  const kmPercorrido =
    v.km_final != null && v.km_inicial != null ? Number(v.km_final) - Number(v.km_inicial) : null;
  const saida = v.saida_em ? new Date(v.saida_em).getTime() : null;
  const chegada = v.chegada_em ? new Date(v.chegada_em).getTime() : null;
  const duracaoMin = saida != null && chegada != null ? Math.max(0, Math.round((chegada - saida) / 60_000)) : null;
  const total = roundMoney(totalDespesas || 0);
  // Custo por km só com a viagem encerrada e km rodado conhecido.
  const custoPorKm =
    v.status === "finalizada" && kmPercorrido != null && kmPercorrido > 0
      ? Math.round((total / kmPercorrido) * 1000) / 1000
      : null;
  return { km_percorrido: kmPercorrido, duracao_min: duracaoMin, total_despesas: total, custo_por_km: custoPorKm };
}

/** Diferença campo a campo (para o histórico). Datas comparadas pelo instante. */
export function diffFields(before, after, fields) {
  const out = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    const a = normalizeForDiff(before[f]);
    const b = normalizeForDiff(after[f]);
    if (a !== b) out[f] = { de: a, para: b };
  }
  return out;
}

function normalizeForDiff(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  return v;
}

/** Campos de dinheiro escondidos de quem não tem viagens.financeiro. */
const FINANCIAL_KEYS = new Set(["valor", "total_despesas", "custo_por_km"]);

/**
 * Remove valores financeiros de um registro do histórico quando o usuário não
 * pode vê-los; remove o detalhe da despesa quando não pode ver despesas.
 */
export function sanitizeHistoricoAlteracoes(entry, vis) {
  const isDespesa = String(entry.acao || "").startsWith("despesa_");
  if (isDespesa && !vis.despesas) return null;
  const alt = entry.alteracoes;
  if (!alt || typeof alt !== "object" || vis.financeiro) return alt ?? null;
  const out = Array.isArray(alt) ? [] : {};
  for (const [k, v] of Object.entries(alt)) {
    if (FINANCIAL_KEYS.has(k)) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v) && !("de" in v)
      ? sanitizeHistoricoAlteracoes({ acao: entry.acao, alteracoes: v }, vis)
      : v;
  }
  return out;
}

/** Data (YYYY-MM-DD) no fuso de Brasília, usada em gastos.data_gasto. */
export function dataLocalBrasil(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function assertNotFuture(date, label, now = Date.now()) {
  if (new Date(date).getTime() > now + FUTURE_TOLERANCE_MS) {
    throw httpError(`${label} não pode estar no futuro.`, 400, "VIAGEM_DATA_FUTURA");
  }
}

/** Valida chegada/km do encerramento contra a saída. */
export function assertEncerramentoValido({ saida_em, km_inicial }, { chegada_em, km_final }) {
  if (chegada_em != null && new Date(chegada_em).getTime() < new Date(saida_em).getTime()) {
    throw httpError("A chegada não pode ser antes da saída.", 400, "VIAGEM_CHEGADA_ANTES_SAIDA");
  }
  if (km_final != null && Number(km_final) < Number(km_inicial)) {
    throw httpError(
      `A quilometragem final (${km_final}) não pode ser menor que a inicial (${km_inicial}).`,
      400,
      "VIAGEM_KM_FINAL_MENOR",
    );
  }
}
