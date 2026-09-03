import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePermissions,
  hasPermission,
  PERMISSIONS,
  normalizeRole,
} from "../../src/utils/permissions.js";

describe("permissions", () => {
  it("admin tem todas", () => {
    const perms = resolvePermissions("admin");
    assert.ok(hasPermission(perms, PERMISSIONS.USERS_MANAGE));
    assert.ok(hasPermission(perms, PERMISSIONS.AUDIT_READ));
  });

  it("operator não gerencia usuários", () => {
    const perms = resolvePermissions("operator");
    assert.equal(hasPermission(perms, PERMISSIONS.USERS_MANAGE), false);
    assert.ok(hasPermission(perms, PERMISSIONS.FROTA_WRITE));
  });

  it("extras somam ao role", () => {
    const perms = resolvePermissions("operator", [PERMISSIONS.AUDIT_READ]);
    assert.ok(hasPermission(perms, PERMISSIONS.AUDIT_READ));
  });

  it("viewer não gerencia usuários nem escreve frota", () => {
    const perms = resolvePermissions("viewer");
    assert.equal(hasPermission(perms, PERMISSIONS.USERS_MANAGE), false);
    assert.equal(hasPermission(perms, PERMISSIONS.FROTA_WRITE), false);
    assert.ok(hasPermission(perms, PERMISSIONS.FROTA_READ));
    assert.ok(hasPermission(perms, PERMISSIONS.NOTAS_READ));
  });

  it("normalizeRole aceita viewer e rejeita desconhecidos", () => {
    assert.equal(normalizeRole("viewer"), "viewer");
    assert.equal(normalizeRole("admin"), "admin");
    assert.equal(normalizeRole("operator"), "operator");
    assert.equal(normalizeRole("superadmin"), "operator");
    assert.equal(normalizeRole(""), "operator");
  });
});
