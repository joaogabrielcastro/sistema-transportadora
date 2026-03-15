import test from "node:test";
import assert from "node:assert/strict";

const importSecurity = async () => {
  const mod = await import(`../src/middleware/security.js?ts=${Date.now()}`);
  return mod;
};

test("requireAuth allows request when AUTH_ENABLED is false", async () => {
  process.env.AUTH_ENABLED = "false";
  const { requireAuth } = await importSecurity();

  let nextCalled = false;
  const req = { headers: {} };
  const res = {
    status() {
      throw new Error("status should not be called");
    },
  };

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("attachRequestContext enriches request and sets x-request-id", async () => {
  const { attachRequestContext } = await importSecurity();

  const req = { headers: {} };
  let responseHeader = null;
  const res = {
    setHeader(name, value) {
      if (name === "x-request-id") {
        responseHeader = value;
      }
    },
  };

  let nextCalled = false;
  attachRequestContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(typeof req.context.requestId, "string");
  assert.equal(req.context.user.id, "anonymous");
  assert.equal(req.context.user.role, "viewer");
  assert.equal(responseHeader, req.context.requestId);
});
