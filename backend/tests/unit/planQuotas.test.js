import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_QUOTAS,
  isQuotaReached,
  quotasForTenant,
  planQuotaError,
  getQuotaUsage,
} from "../../src/utils/planQuotas.js";

test("PLAN_QUOTAS: starter mais restrito que fiscal e complete", () => {
  assert.equal(PLAN_QUOTAS.starter.maxVehicles, 15);
  assert.equal(PLAN_QUOTAS.starter.maxUsers, 3);
  assert.ok(PLAN_QUOTAS.fiscal.maxVehicles > PLAN_QUOTAS.starter.maxVehicles);
  assert.ok(PLAN_QUOTAS.complete.maxVehicles > PLAN_QUOTAS.fiscal.maxVehicles);
});

test("quotasForTenant: isento é ilimitado", () => {
  const q = quotasForTenant({
    id: 1,
    billing_exempt: true,
    plan: "starter",
  });
  assert.equal(q.unlimited, true);
  assert.equal(q.maxVehicles, null);
  assert.equal(q.maxUsers, null);
});

test("quotasForTenant: cobrado usa o plano (fallback starter)", () => {
  const starter = quotasForTenant({
    billing_exempt: false,
    plan: "starter",
  });
  assert.equal(starter.unlimited, false);
  assert.equal(starter.maxVehicles, 15);
  assert.equal(starter.maxUsers, 3);

  const unknown = quotasForTenant({ billing_exempt: false, plan: null });
  assert.equal(unknown.plan, "starter");
  assert.equal(unknown.maxUsers, 3);
});

test("isQuotaReached ignora limite nulo e bloqueia no teto", () => {
  assert.equal(isQuotaReached(99, null), false);
  assert.equal(isQuotaReached(14, 15), false);
  assert.equal(isQuotaReached(15, 15), true);
  assert.equal(isQuotaReached(16, 15), true);
});

test("planQuotaError é 403 com código de cota", () => {
  const err = planQuotaError({
    resource: "vehicles",
    used: 15,
    limit: 15,
    plan: "starter",
  });
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, "PLAN_QUOTA_EXCEEDED");
  assert.match(err.message, /Starter/);
  assert.equal(err.quota.limit, 15);
});

test("getQuotaUsage soma usuários ativos + convites pendentes", async () => {
  const prisma = {
    caminhoes: { count: async () => 12 },
    users: { count: async () => 2 },
    auth_tokens: { count: async () => 1 },
  };
  const usage = await getQuotaUsage(prisma, {
    id: 7,
    billing_exempt: false,
    plan: "starter",
  });
  assert.equal(usage.unlimited, false);
  assert.equal(usage.vehicles.used, 12);
  assert.equal(usage.vehicles.limit, 15);
  assert.equal(usage.users.activeUsers, 2);
  assert.equal(usage.users.pendingInvites, 1);
  assert.equal(usage.users.used, 3);
  assert.equal(usage.users.limit, 3);
});
