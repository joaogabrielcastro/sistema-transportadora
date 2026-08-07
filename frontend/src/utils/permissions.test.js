import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PERMISSIONS, userHasPermission } from "./permissions.js";

describe("userHasPermission", () => {
  it("admin sempre true", () => {
    assert.equal(
      userHasPermission(
        { role: "admin", permissions: [] },
        PERMISSIONS.FROTA_WRITE,
      ),
      true,
    );
  });

  it("respeita lista de permissions", () => {
    const user = {
      role: "viewer",
      permissions: [PERMISSIONS.FROTA_READ],
    };
    assert.equal(userHasPermission(user, PERMISSIONS.FROTA_READ), true);
    assert.equal(userHasPermission(user, PERMISSIONS.FROTA_WRITE), false);
  });
});
