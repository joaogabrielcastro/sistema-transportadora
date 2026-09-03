import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BILLING_TRIAL_DAYS,
  hasBillingAccess,
  PLAN_CARDS,
  PLAN_QUOTAS,
  trialDaysRemaining,
  featureEnabled,
  isVehicleQuotaReached,
  isUserQuotaReached,
} from "./billing.js";

describe("billing utils", () => {
  it("exempt sempre tem acesso", () => {
    assert.equal(
      hasBillingAccess({ billingExempt: true, subscriptionStatus: "canceled" }),
      true,
    );
  });

  it("trial expirado bloqueia", () => {
    assert.equal(
      hasBillingAccess({
        billingExempt: false,
        subscriptionStatus: "trialing",
        trialEndsAt: "2020-01-01T00:00:00.000Z",
      }),
      false,
    );
  });

  it("trialDaysRemaining", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const days = trialDaysRemaining(
      {
        billingExempt: false,
        subscriptionStatus: "trialing",
        trialEndsAt: "2026-06-15T12:00:00.000Z",
      },
      now,
    );
    assert.equal(days, 5);
  });

  it("featureEnabled", () => {
    assert.equal(
      featureEnabled({ features: { ordem_coleta: true } }, "ordem_coleta"),
      true,
    );
    assert.equal(
      featureEnabled({ features: { ordem_coleta: false } }, "ordem_coleta"),
      false,
    );
  });

  it("PLAN_CARDS e trial padrão", () => {
    assert.equal(PLAN_CARDS.length, 3);
    assert.equal(PLAN_CARDS[0].id, "starter");
    assert.equal(PLAN_CARDS[0].trialEligible, true);
    assert.equal(BILLING_TRIAL_DAYS, 14);
    assert.match(PLAN_CARDS[0].highlights[0], /15 veículos/);
  });

  it("PLAN_QUOTAS e tetos na sessão", () => {
    assert.equal(PLAN_QUOTAS.starter.maxUsers, 3);
    assert.equal(
      isVehicleQuotaReached({
        quota: {
          unlimited: false,
          vehicles: { used: 15, limit: 15 },
        },
      }),
      true,
    );
    assert.equal(
      isVehicleQuotaReached({
        quota: { unlimited: true, vehicles: { used: 99, limit: null } },
      }),
      false,
    );
    assert.equal(
      isUserQuotaReached({
        quota: { unlimited: false, users: { used: 2, limit: 3 } },
      }),
      false,
    );
  });
});
