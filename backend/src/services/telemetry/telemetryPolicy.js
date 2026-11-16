import prisma from "../../lib/prisma.js";
import { PLAN_QUOTAS } from "../../utils/planQuotas.js";

/**
 * Retenção do bruto. Estado atual e resumo diário não expiram.
 * O worker roda purgeExpiredTelemetryEvents periodicamente.
 */
export const RAW_EVENT_RETENTION_DAYS = 90;

const PLAN_SEATS = {
  basic: 10,
  advanced: 50,
};

/**
 * Cotas de telemetria. Com assinatura ativa, enforced=true.
 */
export function telemetryLimitsForPlan(plan) {
  const key = plan && PLAN_SEATS[plan] != null ? plan : null;
  return {
    enforced: Boolean(key),
    plan: key,
    maxActiveDevices: key ? PLAN_SEATS[key] : null,
    maxTrackedVehicles: key ? PLAN_SEATS[key] : null,
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

/**
 * Bloqueia novo device se assinatura ativa estourou o seat_limit.
 * Sem assinatura: libera (feature flag já controla o módulo).
 */
export async function assertSeatAvailable(tenantId) {
  const sub = await prisma.telemetry_subscriptions.findFirst({
    where: { tenant_id: Number(tenantId), status: "active" },
    orderBy: { id: "desc" },
  });
  if (!sub || !sub.seat_limit || sub.seat_limit <= 0) return { ok: true, sub };

  const active = await prisma.telemetry_devices.count({
    where: {
      tenant_id: Number(tenantId),
      ativo: true,
      revogado_em: null,
    },
  });
  if (active >= sub.seat_limit) {
    const err = new Error(
      `Limite de ${sub.seat_limit} dispositivos ativos atingido na assinatura de telemetria.`,
    );
    err.statusCode = 403;
    err.code = "TELEMETRY_SEAT_LIMIT";
    throw err;
  }
  return { ok: true, sub, active };
}
