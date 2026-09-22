import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  assignTelemetryDevice,
  createTelemetryDevice,
} from "../../src/services/telemetry/telemetryPrep.js";
import {
  closeTelemetryQueue,
  startTelemetryWorker,
} from "../../src/queues/telemetryJobQueue.js";
import {
  cleanupTenant,
  createSecondaryTenantAdmin,
} from "../helpers/dbTestFixtures.js";

const skip =
  !shouldRunDbTests
    ? "Defina RUN_DB_TESTS=1 ou rode no CI"
    : process.env.REDIS_URL
      ? false
      : "REDIS_URL ausente — a suíte padrão usa a fila em memória";

async function waitForEvent(deviceId, eventId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const row = await prisma.telemetry_events.findFirst({
      where: { device_id: deviceId, event_id: eventId },
    });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

test("BullMQ grava o evento e o estado atual", { skip, timeout: 30_000 }, async () => {
  await startTelemetryWorker();
  const stamp = Date.now().toString(36);
  const tenant = await createSecondaryTenantAdmin({
    slug: `tel-redis-${stamp}`.slice(0, 48),
    email: `redis-${stamp}@saas.test`,
    billingExempt: true,
  });
  try {
    const truck = await prisma.caminhoes.create({
      data: {
        tenant_id: tenant.tenant.id,
        placa: `R${stamp.slice(-6)}`.toUpperCase().padEnd(7, "X").slice(0, 7),
        qtd_pneus: 6,
        km_atual: 1000,
        tipo_veiculo: "truck",
      },
    });
    const secret = `device-secret-redis-${stamp}-ok`;
    const device = await createTelemetryDevice({
      tenantId: tenant.tenant.id,
      externalId: `ext-redis-${stamp}`.slice(0, 64),
      credential: secret,
    });
    await assignTelemetryDevice({
      tenantId: tenant.tenant.id,
      deviceId: device.id,
      caminhaoId: truck.id,
      inicioEm: new Date("2020-01-01T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/v1/telemetry/ingest")
      .set("Authorization", `Device ${secret}`)
      .send({
        event_id: "evt-redis",
        recorded_at: "2026-09-21T20:00:00.000Z",
        latitude: -25.5,
        longitude: -49.2,
        speed_kmh: 10,
        ignition: false,
      });
    assert.equal(res.status, 202, res.body?.error);

    const row = await waitForEvent(device.id, "evt-redis");
    assert.ok(row, "worker BullMQ não persistiu o evento");
    assert.equal(row.tenant_id, tenant.tenant.id);
    assert.equal(row.caminhao_id, truck.id);

    const state = await prisma.telemetry_current_state.findUnique({
      where: { caminhao_id: truck.id },
    });
    assert.equal(new Date(state.registrado_em).toISOString(), "2026-09-21T20:00:00.000Z");
    assert.equal(state.ignicao, false);
  } finally {
    await cleanupTenant(tenant.tenant.id);
    await closeTelemetryQueue();
  }
});
