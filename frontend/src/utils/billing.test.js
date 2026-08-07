import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasBillingAccess,
  trialDaysRemaining,
  featureEnabled,
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
});
