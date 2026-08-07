import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requirePermission } from "../../src/middleware/requirePermission.js";
import {
  resolvePermissions,
  hasPermission,
  PERMISSIONS,
} from "../../src/utils/permissions.js";

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("requirePermission middleware", () => {
  it("viewer não escreve frota", () => {
    const req = {
      context: {
        user: { permissions: resolvePermissions("viewer") },
      },
    };
    const res = mockRes();
    let nextCalled = false;
    requirePermission(PERMISSIONS.FROTA_WRITE)(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
  });

  it("viewer lê frota", () => {
    const req = {
      context: {
        user: { permissions: resolvePermissions("viewer") },
      },
    };
    const res = mockRes();
    let nextCalled = false;
    requirePermission(PERMISSIONS.FROTA_READ)(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });

  it("operator envia ordem mas não gerencia usuários", () => {
    const perms = resolvePermissions("operator");
    assert.ok(hasPermission(perms, PERMISSIONS.ORDEM_SEND));
    assert.equal(hasPermission(perms, PERMISSIONS.USERS_MANAGE), false);
    assert.ok(hasPermission(perms, PERMISSIONS.NOTAS_WRITE));
  });

  it("viewer não importa notas", () => {
    const perms = resolvePermissions("viewer");
    assert.ok(hasPermission(perms, PERMISSIONS.NOTAS_READ));
    assert.equal(hasPermission(perms, PERMISSIONS.NOTAS_WRITE), false);
    assert.equal(hasPermission(perms, PERMISSIONS.GASTOS_WRITE), false);
  });
});
