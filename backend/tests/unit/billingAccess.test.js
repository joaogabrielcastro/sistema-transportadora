import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasActiveSubscriptionAccess } from "../../src/utils/tenantFeatures.js";

describe("requireActiveSubscription contract", () => {
  it("exempt bypassa", () => {
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: true,
        subscription_status: "canceled",
      }),
      true,
    );
  });

  it("sem acesso usa código SUBSCRIPTION_REQUIRED no contrato HTTP", () => {
    const allowed = hasActiveSubscriptionAccess({
      billing_exempt: false,
      subscription_status: "none",
    });
    assert.equal(allowed, false);
    const body = {
      success: false,
      error: "Assinatura necessária para continuar usando o sistema",
      code: "SUBSCRIPTION_REQUIRED",
    };
    assert.equal(body.code, "SUBSCRIPTION_REQUIRED");
  });
});
