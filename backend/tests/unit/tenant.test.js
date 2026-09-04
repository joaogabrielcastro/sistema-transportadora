import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import {
  DEFAULT_TENANT_SLUG,
  ensureSeedTenant,
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

test("ensureSeedTenant recupera tenant quando upsert colide por slug", async () => {
  const upsertOriginal = prisma.tenants.upsert;
  const findUniqueOriginal = prisma.tenants.findUnique;

  const tenant = { id: 99, slug: DEFAULT_TENANT_SLUG };
  prisma.tenants.upsert = async () => {
    const error = new Error("Unique constraint failed");
    error.code = "P2002";
    throw error;
  };
  prisma.tenants.findUnique = async ({ where }) => {
    assert.equal(where.slug, DEFAULT_TENANT_SLUG);
    return tenant;
  };

  try {
    const result = await ensureSeedTenant();
    assert.deepEqual(result, tenant);
  } finally {
    prisma.tenants.upsert = upsertOriginal;
    prisma.tenants.findUnique = findUniqueOriginal;
  }
});
