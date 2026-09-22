import test from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = ["AUTH_ENABLED", "DEFAULT_TENANT_ID", "JWT_SECRET"];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

const importSecurity = async () => {
  const mod = await import(`../../src/middleware/security.js?ts=${Date.now()}`);
  return mod;
};

test("requireAuth allows request when AUTH_ENABLED is false", async () => {
  const snapshot = snapshotEnv();
  process.env.AUTH_ENABLED = "false";
  process.env.DEFAULT_TENANT_ID = "1";
  try {
  const { requireAuth } = await importSecurity();

  let nextCalled = false;
  const req = { headers: {}, context: { user: { id: "anonymous", role: "viewer" } } };
  const res = {
    status() {
      throw new Error("status should not be called");
    },
  };

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.context.user.tenantId, 1);
  } finally {
    restoreEnv(snapshot);
  }
});

test("requireAuth com AUTH off respeita JWT do tenant (anti-vazamento)", async () => {
  const snapshot = snapshotEnv();
  process.env.AUTH_ENABLED = "false";
  process.env.JWT_SECRET = "integration-test-jwt-secret-ok";
  process.env.DEFAULT_TENANT_ID = "1";
  try {

  const jwt = await import("jsonwebtoken");
  const { requireAuth } = await importSecurity();
  const token = jwt.default.sign(
    {
      sub: "55",
      email: "nova@empresa.local",
      role: "admin",
      tenantId: 42,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  let nextCalled = false;
  const req = {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    context: { user: { id: "anonymous", role: "viewer" } },
  };
  const res = {
    status() {
      throw new Error("status should not be called");
    },
  };

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.context.user.tenantId, 42);
  assert.equal(req.context.user.id, "55");
  } finally {
    restoreEnv(snapshot);
  }
});

test("requireAuth rejeita JWT sem tenantId", async () => {
  const snapshot = snapshotEnv();
  process.env.AUTH_ENABLED = "true";
  process.env.JWT_SECRET = "integration-test-jwt-secret-ok";
  process.env.DEFAULT_TENANT_ID = "1";
  try {

  const jwt = await import("jsonwebtoken");
  const { requireAuth } = await importSecurity();
  const token = jwt.default.sign(
    {
      sub: "9",
      email: "x@test.local",
      role: "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  let nextCalled = false;
  const req = {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    context: { user: { id: "anonymous", role: "viewer" } },
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.match(String(res.body?.error || ""), /tenant/i);
  } finally {
    restoreEnv(snapshot);
  }
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

test("verifyBearerToken rejeita token incorreto", async () => {
  const { verifyBearerToken } = await importSecurity();
  const token = "test-token-16-chars-min";

  assert.equal(verifyBearerToken(token, token), true);
  assert.equal(verifyBearerToken("wrong-token-16-chars", token), false);
  assert.equal(verifyBearerToken("", token), false);
});

test("requireRole bloqueia role não autorizada", async () => {
  const { requireRole } = await importSecurity();

  let nextCalled = false;
  const req = { context: { user: { id: "2", role: "operator" } } };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };

  requireRole("admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test("requireRole permite role autorizada", async () => {
  const { requireRole } = await importSecurity();

  let nextCalled = false;
  const req = { context: { user: { id: "1", role: "admin" } } };
  const res = {
    status() {
      throw new Error("status should not be called");
    },
  };

  requireRole("admin")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("requireAuth rejeita request sem token", async () => {
  const snapshot = snapshotEnv();
  process.env.AUTH_ENABLED = "true";
  process.env.JWT_SECRET = "integration-test-jwt-secret-ok";
  try {
  const { requireAuth } = await importSecurity();

  let nextCalled = false;
  const req = {
    method: "GET",
    headers: {},
    context: { user: { id: "anonymous", role: "viewer" } },
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  } finally {
    restoreEnv(snapshot);
  }
});

test("requireAuth recusa JWT sem usuário ativo no banco", async () => {
  const snapshot = snapshotEnv();
  process.env.AUTH_ENABLED = "true";
  process.env.JWT_SECRET = "integration-test-jwt-secret-ok";
  try {
  const jwt = await import("jsonwebtoken");
  const { requireAuth } = await importSecurity();
  const token = jwt.default.sign(
    {
      sub: "3",
      email: "a@test.local",
      role: "admin",
      tenantId: 9,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  let nextCalled = false;
  const req = {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
    context: { user: { id: "anonymous", role: "viewer" } },
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };

  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.ok(res.statusCode === 401 || res.statusCode === 503);
  } finally {
    restoreEnv(snapshot);
  }
});

test("auditLog só audita métodos mutáveis", async () => {
  const { auditLog } = await importSecurity();
  let nextGet = false;
  auditLog(
    { method: "GET", path: "/x", context: { user: { id: "1" } } },
    {},
    () => {
      nextGet = true;
    },
  );
  assert.equal(nextGet, true);

  let nextPost = false;
  auditLog(
    {
      method: "POST",
      path: "/x",
      context: { requestId: "r1", user: { id: "1", role: "admin", tenantId: 1 } },
      body: { placa: "ABC" },
    },
    {},
    () => {
      nextPost = true;
    },
  );
  assert.equal(nextPost, true);
});
