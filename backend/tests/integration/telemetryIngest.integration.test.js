import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  assignTelemetryDevice,
  createTelemetryDevice,
  revokeTelemetryDevice,
  applyIngestedTelemetryEvent,
} from "../../src/services/telemetry/telemetryPrep.js";
import { waitForTelemetryQueueIdle } from "../../src/queues/telemetryJobQueue.js";
import {
  cleanupTenant,
  createSecondaryTenantAdmin,
} from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

function point(eventId, recordedAt, extra = {}) {
  return {
    event_id: eventId,
    recorded_at: recordedAt,
    latitude: -25.4284,
    longitude: -49.2733,
    speed_kmh: 72,
    ignition: true,
    ...extra,
  };
}

function ingest(credential, body) {
  const req = request(app).post("/api/v1/telemetry/ingest");
  if (credential != null) {
    req.set("Authorization", credential);
  }
  return req.send(body);
}

async function makeFleet(label) {
  const stamp = `${label}${Date.now().toString(36)}`;
  const tenant = await createSecondaryTenantAdmin({
    slug: `tel-${stamp}`.slice(0, 48),
    email: `tel-${stamp}@saas.test`,
    nome: `Frota ${label}`,
    billingExempt: true,
  });
  const tail = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase();
  const placa = `${label.replace(/[^a-z0-9]/gi, "").slice(-1) || "T"}${tail}`.slice(0, 7);
  const truck = await prisma.caminhoes.create({
    data: {
      tenant_id: tenant.tenant.id,
      placa,
      qtd_pneus: 6,
      km_atual: 1000,
      tipo_veiculo: "truck",
    },
  });
  const secret = `device-secret-${stamp}-ok`;
  const device = await createTelemetryDevice({
    tenantId: tenant.tenant.id,
    externalId: `ext-${stamp}`.slice(0, 64),
    nome: "Rastreador",
    credential: secret,
  });
  await assignTelemetryDevice({
    tenantId: tenant.tenant.id,
    deviceId: device.id,
    caminhaoId: truck.id,
    inicioEm: new Date("2020-01-01T00:00:00.000Z"),
  });
  return { tenant, truck, secret, device };
}

test("ingestão autentica o dispositivo e rejeita JWT, API_TOKEN, revogado e inexistente", { skip }, async () => {
  const fleet = await makeFleet("auth");
  try {
    const ok = await ingest(
      `Device ${fleet.secret}`,
      point("evt-auth", "2026-09-21T12:00:00.000Z"),
    );
    assert.equal(ok.status, 202, ok.body?.error);
    await waitForTelemetryQueueIdle();

    const stored = await prisma.telemetry_events.findFirst({
      where: { device_id: fleet.device.id, event_id: "evt-auth" },
    });
    assert.equal(stored.tenant_id, fleet.tenant.tenant.id);
    assert.equal(stored.caminhao_id, fleet.truck.id);
    assert.equal(stored.ignicao, true);

    const missing = await ingest(
      "Device credencial-que-nao-existe-ok",
      point("evt-miss", "2026-09-21T12:00:01.000Z"),
    );
    assert.equal(missing.status, 401);

    const token = jwt.sign(
      { sub: "1", tenantId: fleet.tenant.tenant.id, role: "admin" },
      process.env.JWT_SECRET,
    );
    const asJwt = await ingest(
      `Bearer ${token}`,
      point("evt-jwt", "2026-09-21T12:00:02.000Z"),
    );
    assert.equal(asJwt.status, 401);
    assert.equal(asJwt.body.code, "DEVICE_CREDENTIAL_REJECTED");

    const asDeviceJwt = await ingest(
      `Device ${token}`,
      point("evt-djwt", "2026-09-21T12:00:03.000Z"),
    );
    assert.equal(asDeviceJwt.status, 401);

    const asApi = await ingest(
      `Bearer ${process.env.API_TOKEN}`,
      point("evt-api", "2026-09-21T12:00:04.000Z"),
    );
    assert.equal(asApi.status, 401);

    const asDeviceApi = await ingest(
      `Device ${process.env.API_TOKEN}`,
      point("evt-dapi", "2026-09-21T12:00:05.000Z"),
    );
    assert.equal(asDeviceApi.status, 401);

    await revokeTelemetryDevice(fleet.tenant.tenant.id, fleet.device.id);
    const revoked = await ingest(
      `Device ${fleet.secret}`,
      point("evt-rev", "2026-09-21T12:00:06.000Z"),
    );
    assert.equal(revoked.status, 401);
    await waitForTelemetryQueueIdle();

    const leaked = await prisma.telemetry_events.count({
      where: {
        device_id: fleet.device.id,
        event_id: { in: ["evt-miss", "evt-jwt", "evt-djwt", "evt-api", "evt-dapi", "evt-rev"] },
      },
    });
    assert.equal(leaked, 0);
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});

test("payload inválido não entra na fila", { skip }, async () => {
  const cases = [
    point("evt", "2026-09-21T12:00:00.000Z", { latitude: 91 }),
    point("evt", "2026-09-21T12:00:00.000Z", { longitude: -181 }),
    point("evt", "2026-09-21T12:00:00.000Z", { speed_kmh: -1 }),
    point("evt", "ontem", {}),
    { recorded_at: "2026-09-21T12:00:00.000Z", latitude: 0, longitude: 0, speed_kmh: 1, ignition: false },
  ];
  for (const body of cases) {
    const res = await ingest("Device credencial-qualquer-ok-123", body);
    assert.equal(res.status, 400, res.body?.error);
  }
});

test("evento repetido persiste uma linha e o replay do job não duplica", { skip }, async () => {
  const fleet = await makeFleet("idem");
  try {
    const body = point("evt-1", "2026-09-21T13:00:00.000Z");
    const first = await ingest(`Device ${fleet.secret}`, body);
    assert.equal(first.status, 202, first.body?.error);
    await waitForTelemetryQueueIdle();

    const second = await ingest(`Device ${fleet.secret}`, body);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.duplicate, true);
    await waitForTelemetryQueueIdle();

    await applyIngestedTelemetryEvent({
      deviceId: fleet.device.id,
      eventId: "evt-1",
      recordedAt: body.recorded_at,
      receivedAt: new Date().toISOString(),
      latitude: body.latitude,
      longitude: body.longitude,
      speedKmh: body.speed_kmh,
      ignition: body.ignition,
    });

    const count = await prisma.telemetry_events.count({
      where: { device_id: fleet.device.id, event_id: "evt-1" },
    });
    assert.equal(count, 1);
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});

test("ponto atrasado não pisa o estado e a sequência termina no mais novo", { skip }, async () => {
  const fleet = await makeFleet("ord");
  try {
    const secret = `Device ${fleet.secret}`;
    const posts = [
      point("e0", "2026-09-21T10:00:00.000Z", { latitude: -25.1 }),
      point("e1", "2026-09-21T10:01:00.000Z", { latitude: -25.11 }),
      point("e2", "2026-09-21T10:02:00.000Z", { latitude: -25.12 }),
    ];
    for (const body of posts) {
      const res = await ingest(secret, body);
      assert.equal(res.status, 202, res.body?.error);
    }
    await waitForTelemetryQueueIdle();

    const late = await ingest(
      secret,
      point("e1b", "2026-09-21T10:01:00.000Z", { latitude: -25.99 }),
    );
    assert.equal(late.status, 202, late.body?.error);
    await waitForTelemetryQueueIdle();

    let state = await prisma.telemetry_current_state.findUnique({
      where: { caminhao_id: fleet.truck.id },
    });
    assert.equal(new Date(state.registrado_em).toISOString(), "2026-09-21T10:02:00.000Z");
    assert.equal(Number(state.latitude), -25.12);

    const history = await prisma.telemetry_events.count({
      where: { device_id: fleet.device.id },
    });
    assert.equal(history, 4);

    const outOfOrder = [
      point("o0", "2026-09-21T11:00:00.000Z", { latitude: -25.2 }),
      point("o2", "2026-09-21T11:02:00.000Z", { latitude: -25.22 }),
      point("o1", "2026-09-21T11:01:00.000Z", { latitude: -25.21 }),
      point("o3", "2026-09-21T11:03:00.000Z", { latitude: -25.23 }),
    ];
    for (const body of outOfOrder) {
      const res = await ingest(secret, body);
      assert.equal(res.status, 202, res.body?.error);
    }
    await waitForTelemetryQueueIdle();

    state = await prisma.telemetry_current_state.findUnique({
      where: { caminhao_id: fleet.truck.id },
    });
    assert.equal(new Date(state.registrado_em).toISOString(), "2026-09-21T11:03:00.000Z");
    assert.equal(Number(state.latitude), -25.23);

    const truck = await prisma.caminhoes.findUnique({ where: { id: fleet.truck.id } });
    assert.equal(truck.km_atual, 1000);
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});

test("sem vínculo ou vínculo encerrado não grava evento", { skip }, async () => {
  const fleet = await makeFleet("asg");
  try {
    await prisma.telemetry_device_assignments.updateMany({
      where: { device_id: fleet.device.id, fim_em: null },
      data: { fim_em: new Date("2020-01-01T00:00:00.000Z") },
    });
    const ended = await ingest(
      `Device ${fleet.secret}`,
      point("evt-end", "2026-09-21T15:00:00.000Z"),
    );
    assert.equal(ended.status, 409);
    assert.equal(ended.body.code, "ASSIGNMENT_REQUIRED");

    const bareTenant = await createSecondaryTenantAdmin({
      slug: `tel-none-${Date.now().toString(36)}`.slice(0, 48),
      email: `none-${Date.now().toString(36)}@saas.test`,
      billingExempt: true,
    });
    const bareSecret = `device-secret-none-${Date.now().toString(36)}-ok`;
    const bare = await createTelemetryDevice({
      tenantId: bareTenant.tenant.id,
      externalId: `ext-none-${Date.now().toString(36)}`.slice(0, 64),
      credential: bareSecret,
    });
    const missing = await ingest(
      `Device ${bareSecret}`,
      point("evt-none", "2026-09-21T15:00:00.000Z"),
    );
    assert.equal(missing.status, 409);
    await waitForTelemetryQueueIdle();
    const count = await prisma.telemetry_events.count({
      where: { device_id: { in: [fleet.device.id, bare.id] } },
    });
    assert.equal(count, 0);
    await cleanupTenant(bareTenant.tenant.id);
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});

test("dispositivo de um tenant não grava veículo de outro", { skip }, async () => {
  const a = await makeFleet("tenA");
  const b = await makeFleet("tenB");
  try {
    const sneaky = await ingest(`Device ${a.secret}`, {
      ...point("evt-cross", "2026-09-21T16:00:00.000Z"),
      tenant_id: b.tenant.tenant.id,
      vehicle_id: b.truck.id,
    });
    assert.equal(sneaky.status, 400);

    const ok = await ingest(
      `Device ${a.secret}`,
      point("evt-own", "2026-09-21T16:00:01.000Z"),
    );
    assert.equal(ok.status, 202, ok.body?.error);
    await waitForTelemetryQueueIdle();

    const event = await prisma.telemetry_events.findFirst({
      where: { device_id: a.device.id, event_id: "evt-own" },
    });
    assert.equal(event.tenant_id, a.tenant.tenant.id);
    assert.equal(event.caminhao_id, a.truck.id);
    assert.notEqual(event.caminhao_id, b.truck.id);

    const foreign = await prisma.telemetry_events.count({
      where: { tenant_id: b.tenant.tenant.id },
    });
    assert.equal(foreign, 0);
    const stateB = await prisma.telemetry_current_state.findUnique({
      where: { caminhao_id: b.truck.id },
    });
    assert.equal(stateB, null);
  } finally {
    await cleanupTenant(a.tenant.tenant.id);
    await cleanupTenant(b.tenant.tenant.id);
  }
});

async function burst(secret, total, prefix) {
  for (let i = 0; i < total; i += 1) {
    const res = await ingest(
      `Device ${secret}`,
      point(`${prefix}-${i}`, new Date(Date.UTC(2026, 8, 21, 18, 0, i)).toISOString(), {
        latitude: -25.4 + i * 0.00001,
      }),
    );
    assert.equal(res.status, 202, res.body?.error);
  }
  await waitForTelemetryQueueIdle();
}

test("cem eventos sequenciais não duplicam", { skip, timeout: 120_000 }, async () => {
  const fleet = await makeFleet("c100");
  try {
    await burst(fleet.secret, 100, "b100");
    const count = await prisma.telemetry_events.count({
      where: { device_id: fleet.device.id },
    });
    assert.equal(count, 100);
    const again = await ingest(
      `Device ${fleet.secret}`,
      point("b100-0", new Date(Date.UTC(2026, 8, 21, 18, 0, 0)).toISOString()),
    );
    assert.equal(again.status, 200);
    assert.equal(again.body.data.duplicate, true);
    const after = await prisma.telemetry_events.count({
      where: { device_id: fleet.device.id },
    });
    assert.equal(after, 100);
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});

test("mil eventos sequenciais não duplicam", { skip, timeout: 180_000 }, async () => {
  const fleet = await makeFleet("c1000");
  try {
    await burst(fleet.secret, 1000, "b1000");
    const count = await prisma.telemetry_events.count({
      where: { device_id: fleet.device.id },
    });
    assert.equal(count, 1000);
    const state = await prisma.telemetry_current_state.findUnique({
      where: { caminhao_id: fleet.truck.id },
    });
    assert.equal(new Date(state.registrado_em).toISOString(), new Date(Date.UTC(2026, 8, 21, 18, 0, 999)).toISOString());
  } finally {
    await cleanupTenant(fleet.tenant.tenant.id);
  }
});
