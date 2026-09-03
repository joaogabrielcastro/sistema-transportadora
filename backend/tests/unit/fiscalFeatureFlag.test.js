import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_FEATURES,
  DEFAULT_TENANT_FEATURES,
  TRANS_MOTIN_FEATURES,
  resolveTenantFeatures,
  featuresForPlan,
} from "../../src/utils/tenantFeatures.js";
import {
  PERMISSIONS,
  resolvePermissions,
  hasPermission,
} from "../../src/utils/permissions.js";

describe("feature flag transporte_fiscal", () => {
  it("default false em todos os planos existentes", () => {
    for (const plano of ["starter", "ops", "fiscal", "complete"]) {
      assert.equal(
        PLAN_FEATURES[plano].transporte_fiscal,
        false,
        `plano ${plano}`,
      );
    }
    assert.equal(DEFAULT_TENANT_FEATURES.transporte_fiscal, false);
    assert.equal(TRANS_MOTIN_FEATURES.transporte_fiscal, false);
    assert.equal(featuresForPlan("complete").transporte_fiscal, false);
  });

  it("não quebra as chaves existentes (ordem_coleta / notas_estoque)", () => {
    // ordem_coleta não entra em plano — só o tenant ABroto (slug).
    assert.equal(PLAN_FEATURES.ops.ordem_coleta, false);
    assert.equal(PLAN_FEATURES.fiscal.notas_estoque, true);
    assert.deepEqual(featuresForPlan("ops"), PLAN_FEATURES.ops);
  });

  it("override explícito em tenants.features liga a feature", () => {
    const f = resolveTenantFeatures({
      billingExempt: false,
      plan: "complete",
      raw: { transporte_fiscal: true },
    });
    assert.equal(f.transporte_fiscal, true);
    assert.equal(f.notas_estoque, true);
    assert.equal(f.ordem_coleta, false);
  });

  it("sem override, transporte_fiscal continua false", () => {
    const f = resolveTenantFeatures({
      billingExempt: true,
      slug: "abbroto",
      raw: {},
    });
    assert.equal(f.transporte_fiscal, false);
  });
});

describe("permissões fiscais", () => {
  it("admin recebe CTE/MDFE/CIOT read+write", () => {
    const perms = resolvePermissions("admin");
    for (const p of [
      PERMISSIONS.CTE_READ,
      PERMISSIONS.CTE_WRITE,
      PERMISSIONS.MDFE_READ,
      PERMISSIONS.MDFE_WRITE,
      PERMISSIONS.CIOT_READ,
      PERMISSIONS.CIOT_WRITE,
    ]) {
      assert.ok(hasPermission(perms, p), p);
    }
  });

  it("operator NÃO recebe permissões fiscais por padrão", () => {
    const perms = resolvePermissions("operator");
    for (const p of [
      PERMISSIONS.CTE_READ,
      PERMISSIONS.CTE_WRITE,
      PERMISSIONS.MDFE_WRITE,
      PERMISSIONS.CIOT_WRITE,
    ]) {
      assert.equal(hasPermission(perms, p), false, p);
    }
  });

  it("operator pode receber fiscal via users.permissions (extras)", () => {
    const perms = resolvePermissions("operator", [PERMISSIONS.CTE_READ]);
    assert.ok(hasPermission(perms, PERMISSIONS.CTE_READ));
    assert.equal(hasPermission(perms, PERMISSIONS.CTE_WRITE), false);
  });
});
