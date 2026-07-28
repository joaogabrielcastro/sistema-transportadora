import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TENANT_SLUG,
  requireTenantId,
  resolveDefaultTenantId,
} from "../../src/utils/tenant.js";

test("DEFAULT_TENANT_SLUG é abbroto", () => {
  assert.equal(DEFAULT_TENANT_SLUG, "abbroto");
});

test("requireTenantId retorna id válido", () => {
  assert.equal(requireTenantId({ context: { user: { tenantId: 3 } } }), 3);
  assert.equal(requireTenantId({ context: { user: { tenantId: "7" } } }), 7);
});

test("requireTenantId lança 401 quando ausente ou inválido", () => {
  for (const req of [
    {},
    { context: {} },
    { context: { user: {} } },
    { context: { user: { tenantId: 0 } } },
    { context: { user: { tenantId: "x" } } },
  ]) {
    assert.throws(
      () => requireTenantId(req),
      (err) => err.statusCode === 401 && /Tenant/i.test(err.message),
    );
  }
});

test("resolveDefaultTenantId usa DEFAULT_TENANT_ID do env", async () => {
  const prev = process.env.DEFAULT_TENANT_ID;
  process.env.DEFAULT_TENANT_ID = "42";
  try {
    assert.equal(await resolveDefaultTenantId(), 42);
  } finally {
    if (prev === undefined) delete process.env.DEFAULT_TENANT_ID;
    else process.env.DEFAULT_TENANT_ID = prev;
  }
});
