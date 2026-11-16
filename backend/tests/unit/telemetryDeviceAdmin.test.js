import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  connectionStatusFor,
  generateDeviceCredential,
  serializeTelemetryDevice,
  TELEMETRY_OFFLINE_AFTER_MS,
} from "../../src/services/telemetry/telemetryDeviceAdmin.js";
import {
  PERMISSIONS,
  resolvePermissions,
  hasPermission,
} from "../../src/utils/permissions.js";
import {
  PLAN_FEATURES,
  DEFAULT_TENANT_FEATURES,
  resolveTenantFeatures,
} from "../../src/utils/tenantFeatures.js";

describe("telemetry device admin helpers", () => {
  it("gera credencial longa o bastante", () => {
    const secret = generateDeviceCredential();
    assert.ok(secret.length >= 32);
  });

  it("connection_status: awaiting / online / offline / revoked", () => {
    assert.equal(connectionStatusFor({ ativo: true, revogado_em: null }), "awaiting");
    assert.equal(
      connectionStatusFor({
        ativo: true,
        revogado_em: null,
        last_seen_at: new Date(),
      }),
      "online",
    );
    assert.equal(
      connectionStatusFor({
        ativo: true,
        revogado_em: null,
        last_seen_at: new Date(Date.now() - TELEMETRY_OFFLINE_AFTER_MS - 1_000),
      }),
      "offline",
    );
    assert.equal(
      connectionStatusFor({
        ativo: false,
        revogado_em: new Date(),
        last_seen_at: new Date(),
      }),
      "revoked",
    );
  });

  it("serialize nunca inclui credential_hash", () => {
    const out = serializeTelemetryDevice({
      id: 1,
      tenant_id: 2,
      external_id: "ext",
      nome: "X",
      manufacturer: null,
      model: null,
      imei: null,
      protocol: "http_json",
      connection_type: null,
      ownership_type: "CUSTOMER",
      credential_hash: "abc",
      ativo: true,
      revogado_em: null,
      last_seen_at: null,
      criado_em: new Date(),
      atualizado_em: new Date(),
    });
    assert.equal(out.credential_hash, undefined);
    assert.equal(out.connection_status, "awaiting");
    assert.equal(out.protocol, "http_json");
  });
});

describe("feature e permissões telemetria", () => {
  it("nenhum plano libera telemetria automaticamente", () => {
    for (const plan of Object.keys(PLAN_FEATURES)) {
      assert.equal(PLAN_FEATURES[plan].telemetria, false, plan);
    }
    assert.equal(DEFAULT_TENANT_FEATURES.telemetria, false);
  });

  it("JSON pode ligar telemetria como add-on em plano Starter", () => {
    const f = resolveTenantFeatures({
      billingExempt: false,
      plan: "starter",
      raw: { telemetria: true, transporte_fiscal: true },
    });
    assert.equal(f.telemetria, true);
    assert.equal(f.transporte_fiscal, false);
  });

  it("billing_exempt também respeita telemetria no JSON", () => {
    const off = resolveTenantFeatures({
      billingExempt: true,
      slug: "demo",
      raw: {},
    });
    assert.equal(off.telemetria, false);
    const on = resolveTenantFeatures({
      billingExempt: true,
      slug: "demo",
      raw: { telemetria: true },
    });
    assert.equal(on.telemetria, true);
  });

  it("admin e operator têm telemetry read/write; viewer só read", () => {
    const admin = resolvePermissions("admin");
    assert.ok(hasPermission(admin, PERMISSIONS.TELEMETRY_READ));
    assert.ok(hasPermission(admin, PERMISSIONS.TELEMETRY_WRITE));

    const op = resolvePermissions("operator");
    assert.ok(hasPermission(op, PERMISSIONS.TELEMETRY_READ));
    assert.ok(hasPermission(op, PERMISSIONS.TELEMETRY_WRITE));

    const viewer = resolvePermissions("viewer");
    assert.ok(hasPermission(viewer, PERMISSIONS.TELEMETRY_READ));
    assert.equal(hasPermission(viewer, PERMISSIONS.TELEMETRY_WRITE), false);
  });
});
