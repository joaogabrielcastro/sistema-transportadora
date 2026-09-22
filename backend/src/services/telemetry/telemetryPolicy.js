import { PLAN_QUOTAS } from "../../utils/planQuotas.js";

/**
 * Retenção inicial do bruto. Estado atual e resumo diário não expiram.
 * Não há job de expurgo nesta fase.
 */
export const RAW_EVENT_RETENTION_DAYS = 90;

/**
 * Cotas de telemetria ainda não são cobradas nem bloqueiam o plano atual.
 * Quando forem ligadas, o limite conta dispositivo ativo vinculado a veículo,
 * não a quantidade de eventos.
 */
export function telemetryLimitsForPlan(plan) {
  return {
    enforced: false,
    plan: plan ?? null,
    maxActiveDevices: null,
    maxTrackedVehicles: null,
    rawRetentionDays: RAW_EVENT_RETENTION_DAYS,
    currentStateRetention: "indefinite",
    dailySummaryRetention: "indefinite",
    countsEvents: false,
  };
}

/** Os tetos comerciais de frota e usuário permanecem os de planQuotas.js. */
export function commercialQuotasUnchanged() {
  return {
    starter: { ...PLAN_QUOTAS.starter },
    ops: { ...PLAN_QUOTAS.ops },
    fiscal: { ...PLAN_QUOTAS.fiscal },
    complete: { ...PLAN_QUOTAS.complete },
  };
}

/**
 * Estado atual avança só com relógio do aparelho estritamente mais novo.
 * Empate não sobrescreve. Ponto atrasado fica no histórico e não pisa o mapa.
 */
export function shouldAdvanceCurrentState(currentRecordedAt, incomingRecordedAt) {
  if (incomingRecordedAt == null) return false;
  if (currentRecordedAt == null) return true;
  const current = new Date(currentRecordedAt).getTime();
  const incoming = new Date(incomingRecordedAt).getTime();
  if (!Number.isFinite(current) || !Number.isFinite(incoming)) return false;
  return incoming > current;
}

const JWT_SHAPED = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Credencial de rastreador não reutiliza JWT de usuário nem API_TOKEN.
 * O valor em claro não é persistido.
 */
export function assertDeviceCredentialAllowed(raw) {
  const value = String(raw || "").trim();
  if (value.length < 16) {
    const err = new Error("Credencial de dispositivo curta demais.");
    err.statusCode = 400;
    err.code = "DEVICE_CREDENTIAL_REJECTED";
    throw err;
  }
  if (JWT_SHAPED.test(value)) {
    const err = new Error(
      "Credencial de dispositivo não pode ser um JWT de usuário.",
    );
    err.statusCode = 400;
    err.code = "DEVICE_CREDENTIAL_REJECTED";
    throw err;
  }
  const apiToken = String(process.env.API_TOKEN || "");
  if (apiToken && value === apiToken) {
    const err = new Error(
      "Credencial de dispositivo não pode ser o API_TOKEN administrativo.",
    );
    err.statusCode = 400;
    err.code = "DEVICE_CREDENTIAL_REJECTED";
    throw err;
  }
  return value;
}
