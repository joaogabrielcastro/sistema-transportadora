import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  cleanupTenant,
  createSecondaryTenantAdmin,
  loginWithCredentials,
} from "../helpers/dbTestFixtures.js";
import { waitForTelemetryQueueIdle } from "../../src/queues/telemetryJobQueue.js";
import { hashPassword } from "../../src/utils/password.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

async function makeTelemetryTenant(label) {
  const stamp = `${label}${Date.now().toString(36)}`;
  const secondary = await createSecondaryTenantAdmin({
    slug: `tadm-${stamp}`.slice(0, 48),
    email: `tadm-${stamp}@saas.test`,
    nome: `TelAdmin ${label}`,
    billingExempt: true,
    features: { telemetria: true, ordem_coleta: false, notas_estoque: false },
  });
  const auth = await loginWithCredentials(
    app,
    secondary.email,
    secondary.password,
  );
  const placa = `T${stamp.replace(/[^a-z0-9]/gi, "").slice(-6)}`
    .toUpperCase()
    .padEnd(7, "X")
    .slice(0, 7);
  const truck = await prisma.caminhoes.create({
    data: {
      tenant_id: secondary.tenant.id,
      placa,
      qtd_pneus: 6,
      km_atual: 1000,
      tipo_veiculo: "truck",
    },
  });
  return { secondary, auth, truck };
}

test("sem feature telemetria a API admin responde 403", { skip }, async () => {
  const stamp = Date.now().toString(36);
  const secondary = await createSecondaryTenantAdmin({
    slug: `tnofeat-${stamp}`.slice(0, 48),
    email: `tnofeat-${stamp}@saas.test`,
    billingExempt: true,
    features: { telemetria: false },
  });
  try {
    const auth = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );
    const res = await request(app)
      .get("/api/telemetry/devices")
      .set(auth.authHeader);
    assert.equal(res.status, 403);
    assert.equal(res.body.feature, "telemetria");
  } finally {
    await cleanupTenant(secondary.tenant.id);
  }
});

test("CRUD dispositivo, assign, current/history e last_seen no ingest", { skip }, async () => {
  const fleet = await makeTelemetryTenant("ok");
  try {
    const created = await request(app)
      .post("/api/telemetry/devices")
      .set(fleet.auth.authHeader)
      .send({
        external_id: `imei-${fleet.truck.id}`,
        nome: "FMC130",
        manufacturer: "Teltonika",
        model: "FMC130",
        ownership_type: "ATRACK",
        caminhao_id: fleet.truck.id,
      });
    assert.equal(created.status, 201, created.body?.error);
    assert.ok(created.body.data.credential);
    assert.equal(created.body.data.device.assignment.caminhao_id, fleet.truck.id);
    assert.equal(created.body.data.device.connection_status, "awaiting");
    assert.equal(created.body.data.device.ownership_type, "ATRACK");

    const deviceId = created.body.data.device.id;
    const secret = created.body.data.credential;

    const listed = await request(app)
      .get("/api/telemetry/devices")
      .set(fleet.auth.authHeader);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].credential_hash, undefined);

    const ingest = await request(app)
      .post("/api/v1/telemetry/ingest")
      .set("Authorization", `Device ${secret}`)
      .send({
        event_id: `adm-${Date.now()}`,
        recorded_at: "2026-11-13T12:00:00.000Z",
        latitude: -25.4,
        longitude: -49.2,
        speed_kmh: 55,
        ignition: true,
      });
    assert.equal(ingest.status, 202, ingest.body?.error);
    await waitForTelemetryQueueIdle();

    const deviceAfter = await prisma.telemetry_devices.findUnique({
      where: { id: deviceId },
    });
    assert.ok(deviceAfter.last_seen_at);

    const current = await request(app)
      .get("/api/telemetry/current")
      .set(fleet.auth.authHeader);
    assert.equal(current.status, 200);
    assert.equal(current.body.data.length, 1);
    assert.equal(current.body.data[0].caminhao_id, fleet.truck.id);
    assert.equal(current.body.data[0].connection_status, "online");

    const history = await request(app)
      .get("/api/telemetry/history")
      .query({ caminhao_id: fleet.truck.id, limit: 10 })
      .set(fleet.auth.authHeader);
    assert.equal(history.status, 200);
    assert.ok(history.body.data.count >= 1);

    const other = await createSecondaryTenantAdmin({
      slug: `tcross-${Date.now().toString(36)}`.slice(0, 48),
      email: `tcross-${Date.now().toString(36)}@saas.test`,
      billingExempt: true,
      features: { telemetria: true },
    });
    try {
      const otherAuth = await loginWithCredentials(
        app,
        other.email,
        other.password,
      );
      const leak = await request(app)
        .get(`/api/telemetry/devices/${deviceId}`)
        .set(otherAuth.authHeader);
      assert.equal(leak.status, 404);

      const leakHistory = await request(app)
        .get("/api/telemetry/history")
        .query({ caminhao_id: fleet.truck.id })
        .set(otherAuth.authHeader);
      assert.equal(leakHistory.status, 404);
    } finally {
      await cleanupTenant(other.tenant.id);
    }

    const revoked = await request(app)
      .post(`/api/telemetry/devices/${deviceId}/revoke`)
      .set(fleet.auth.authHeader);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.data.connection_status, "revoked");
  } finally {
    await cleanupTenant(fleet.secondary.tenant.id);
  }
});

test("plano/preço do módulo (PUT /subscription) só o admin altera", { skip }, async () => {
  const fleet = await makeTelemetryTenant("sub");
  try {
    const email = `oper-${Date.now().toString(36)}@saas.test`;
    const password = "Operador123!";
    await prisma.users.create({
      data: {
        tenant_id: fleet.secondary.tenant.id,
        email,
        nome: "Operador",
        role: "operator",
        password_hash: await hashPassword(password),
        ativo: true,
      },
    });
    const operator = await loginWithCredentials(app, email, password);

    // Operador tem telemetry.write, mas não pode mexer em dados comerciais.
    const denied = await request(app)
      .put("/api/telemetry/subscription")
      .set(operator.authHeader)
      .send({ plan: "advanced", seat_limit: 99, monthly_price: 1 });
    assert.equal(denied.status, 403);

    const read = await request(app)
      .get("/api/telemetry/subscription")
      .set(operator.authHeader);
    assert.equal(read.status, 200);

    const allowed = await request(app)
      .put("/api/telemetry/subscription")
      .set(fleet.auth.authHeader)
      .send({ plan: "basic", seat_limit: 10, monthly_price: 49 });
    assert.equal(allowed.status, 200);
  } finally {
    await cleanupTenant(fleet.secondary.tenant.id);
  }
});
