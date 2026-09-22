import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import {
  advanceCurrentState,
  assignTelemetryDevice,
  createTelemetryDevice,
  recordTelemetryEvent,
  resolveDeviceByCredential,
  revokeTelemetryDevice,
} from "../../src/services/telemetry/telemetryPrep.js";
import {
  cleanupCaminhao,
  cleanupTenant,
  createCaminhaoViaApi,
  createSecondaryTenantAdmin,
  loginWithCredentials,
  testPlaca,
} from "../helpers/dbTestFixtures.js";
import app from "../../src/app.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

async function ensureOpenAssignmentIndexes() {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_device_open_idx"
    ON "telemetry_device_assignments" ("device_id") WHERE "fim_em" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_device_assignments_caminhao_open_idx"
    ON "telemetry_device_assignments" ("caminhao_id") WHERE "fim_em" IS NULL
  `);
}

test("evento repetido grava uma linha e eventos distintos gravam três", { skip }, async () => {
  const secondary = await createSecondaryTenantAdmin({
    slug: `tel-${Date.now().toString(36)}`,
  });
  const secret = `device-secret-${Date.now().toString(36)}-ok`;
  let device;
  try {
    device = await createTelemetryDevice({
      tenantId: secondary.tenant.id,
      externalId: `ext-${Date.now().toString(36)}`,
      nome: "Rastreador teste",
      credential: secret,
    });
    assert.notEqual(device.credential_hash, secret);
    assert.equal(device.credential_hash.length, 64);

    const base = {
      deviceId: device.id,
      registradoEm: "2026-09-21T15:00:00.000Z",
      recebidoEm: "2026-09-21T15:00:05.000Z",
      latitude: -25.4284,
      longitude: -49.2733,
    };

    const first = await recordTelemetryEvent({ ...base, eventId: "evt-a" });
    const second = await recordTelemetryEvent({ ...base, eventId: "evt-a" });
    const third = await recordTelemetryEvent({ ...base, eventId: "evt-a" });
    assert.equal(first.inserted, true);
    assert.equal(second.duplicate, true);
    assert.equal(third.duplicate, true);

    const many = await Promise.all([
      recordTelemetryEvent({ ...base, eventId: "evt-b" }),
      recordTelemetryEvent({ ...base, eventId: "evt-c" }),
    ]);
    assert.equal(many.filter((row) => row.inserted).length, 2);

    const [sameTimeA, sameTimeB] = await Promise.all([
      recordTelemetryEvent({ ...base, eventId: "evt-race" }),
      recordTelemetryEvent({ ...base, eventId: "evt-race" }),
    ]);
    const inserted = [sameTimeA, sameTimeB].filter((row) => row.inserted).length;
    assert.equal(inserted, 1);

    const count = await prisma.telemetry_events.count({
      where: { device_id: device.id },
    });
    assert.equal(count, 4);

    await assert.rejects(
      () =>
        recordTelemetryEvent({
          ...base,
          eventId: "evt-spoof",
          payloadTenantId: secondary.tenant.id + 999,
        }),
      /tenant_id/,
    );

    const resolved = await resolveDeviceByCredential(secret);
    assert.equal(resolved.id, device.id);
    assert.equal(resolved.tenant_id, secondary.tenant.id);
    await revokeTelemetryDevice(secondary.tenant.id, device.id);
    assert.equal(await resolveDeviceByCredential(secret), null);
  } finally {
    await cleanupTenant(secondary.tenant.id);
  }
});

test("vínculo antigo permanece e ponto atrasado não pisa o estado atual", { skip }, async () => {
  await ensureOpenAssignmentIndexes();
  const secondary = await createSecondaryTenantAdmin({
    slug: `tel2-${Date.now().toString(36)}`,
  });
  const session = await loginWithCredentials(app, secondary.email, secondary.password);
  let firstVehicle;
  let secondVehicle;
  try {
    firstVehicle = await createCaminhaoViaApi(app, session.authHeader, {
      placa: testPlaca("TA"),
    });
    secondVehicle = await createCaminhaoViaApi(app, session.authHeader, {
      placa: testPlaca("TB"),
    });
    const device = await createTelemetryDevice({
      tenantId: secondary.tenant.id,
      externalId: `ext-${Date.now().toString(36)}`,
      credential: `device-secret-${Date.now().toString(36)}-ok`,
    });

    const first = await assignTelemetryDevice({
      tenantId: secondary.tenant.id,
      deviceId: device.id,
      caminhaoId: firstVehicle.id,
      inicioEm: "2026-01-01T00:00:00.000Z",
    });
    const second = await assignTelemetryDevice({
      tenantId: secondary.tenant.id,
      deviceId: device.id,
      caminhaoId: secondVehicle.id,
      inicioEm: "2026-06-01T00:00:00.000Z",
    });

    const rows = await prisma.telemetry_device_assignments.findMany({
      where: { device_id: device.id },
      orderBy: { inicio_em: "asc" },
    });
    assert.equal(rows.length, 2);
    assert.ok(rows[0].fim_em);
    assert.equal(rows[1].fim_em, null);
    assert.equal(first.caminhao_id, firstVehicle.id);
    assert.equal(second.caminhao_id, secondVehicle.id);

    const newer = await advanceCurrentState({
      tenantId: secondary.tenant.id,
      caminhaoId: secondVehicle.id,
      deviceId: device.id,
      registradoEm: "2026-09-21T15:10:00.000Z",
      recebidoEm: "2026-09-21T15:10:02.000Z",
      latitude: -25.1,
      longitude: -49.2,
      velocidadeKmh: 80,
    });
    assert.equal(newer.advanced, true);

    const older = await advanceCurrentState({
      tenantId: secondary.tenant.id,
      caminhaoId: secondVehicle.id,
      deviceId: device.id,
      registradoEm: "2026-09-21T15:05:00.000Z",
      recebidoEm: "2026-09-21T15:20:00.000Z",
      latitude: 0,
      longitude: 0,
      velocidadeKmh: 10,
    });
    assert.equal(older.advanced, false);
    assert.equal(
      new Date(older.state.registrado_em).toISOString(),
      "2026-09-21T15:10:00.000Z",
    );
  } finally {
    await cleanupCaminhao(firstVehicle?.id);
    await cleanupCaminhao(secondVehicle?.id);
    await cleanupTenant(secondary.tenant.id);
  }
});
