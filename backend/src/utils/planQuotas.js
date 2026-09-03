import { AUTH_TOKEN_PURPOSE } from "./authTokens.js";

/** Tetos por plano cobrado. `null` = ilimitado (tenants isentos). */
export const PLAN_QUOTAS = Object.freeze({
  starter: Object.freeze({ maxVehicles: 15, maxUsers: 3 }),
  ops: Object.freeze({ maxVehicles: 40, maxUsers: 8 }),
  fiscal: Object.freeze({ maxVehicles: 40, maxUsers: 8 }),
  complete: Object.freeze({ maxVehicles: 100, maxUsers: 20 }),
});

const PLAN_LABEL = Object.freeze({
  starter: "Starter",
  ops: "Ops",
  fiscal: "Fiscal",
  complete: "Completo",
});

export function isQuotaReached(used, limit) {
  if (limit == null) return false;
  return Number(used) >= Number(limit);
}

export function quotasForTenant(tenant) {
  if (!tenant || tenant.billing_exempt === true || tenant.billingExempt === true) {
    return {
      maxVehicles: null,
      maxUsers: null,
      unlimited: true,
      plan: tenant?.plan ?? null,
    };
  }

  const plan =
    tenant.plan && Object.prototype.hasOwnProperty.call(PLAN_QUOTAS, tenant.plan)
      ? tenant.plan
      : "starter";
  const q = PLAN_QUOTAS[plan];
  return {
    maxVehicles: q.maxVehicles,
    maxUsers: q.maxUsers,
    unlimited: false,
    plan,
  };
}

export function planQuotaError({ resource, used, limit, plan }) {
  const resourceLabel = resource === "users" ? "usuários" : "veículos";
  const planLabel = PLAN_LABEL[plan] || "atual";
  const err = new Error(
    `Limite do plano ${planLabel} atingido (${used}/${limit} ${resourceLabel}). Faça upgrade em Assinatura para continuar.`,
  );
  err.statusCode = 403;
  err.code = "PLAN_QUOTA_EXCEEDED";
  err.quota = { resource, used, limit, plan };
  return err;
}

export async function getQuotaUsage(prisma, tenant) {
  const limits = quotasForTenant(tenant);
  const tenantId = Number(tenant?.id);

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return {
      unlimited: true,
      plan: null,
      vehicles: { used: 0, limit: null },
      users: { used: 0, limit: null, activeUsers: 0, pendingInvites: 0 },
    };
  }

  const [vehicles, activeUsers, pendingInvites] = await Promise.all([
    prisma.caminhoes.count({ where: { tenant_id: tenantId } }),
    prisma.users.count({ where: { tenant_id: tenantId, ativo: true } }),
    prisma.auth_tokens.count({
      where: {
        tenant_id: tenantId,
        purpose: AUTH_TOKEN_PURPOSE.INVITE,
        used_at: null,
        expires_at: { gt: new Date() },
      },
    }),
  ]);

  return {
    unlimited: limits.unlimited,
    plan: limits.plan,
    vehicles: { used: vehicles, limit: limits.maxVehicles },
    users: {
      used: activeUsers + pendingInvites,
      limit: limits.maxUsers,
      activeUsers,
      pendingInvites,
    },
  };
}

export async function assertCanAddVehicle(prisma, tenant) {
  const usage = await getQuotaUsage(prisma, tenant);
  if (isQuotaReached(usage.vehicles.used, usage.vehicles.limit)) {
    throw planQuotaError({
      resource: "vehicles",
      used: usage.vehicles.used,
      limit: usage.vehicles.limit,
      plan: usage.plan,
    });
  }
}

/**
 * @param {{ convertingInvite?: boolean }} [opts]
 * convertingInvite: no aceite, a vaga do convite já entra em `users.used`;
 * conta só usuários ativos para não bloquear o próprio convite.
 */
export async function assertCanAddUserSeat(prisma, tenant, opts = {}) {
  const usage = await getQuotaUsage(prisma, tenant);
  const used = opts.convertingInvite
    ? usage.users.activeUsers
    : usage.users.used;
  if (isQuotaReached(used, usage.users.limit)) {
    throw planQuotaError({
      resource: "users",
      used,
      limit: usage.users.limit,
      plan: usage.plan,
    });
  }
}
