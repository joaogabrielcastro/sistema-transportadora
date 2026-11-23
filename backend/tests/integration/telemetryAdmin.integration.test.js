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
import {
  CODEC8,
  buildAvlPacket,
  tryParseAvlPacket,
} from "../../src/services/telemetry/protocols/teltonika/codec8.js";
import { IO } from "../../src/services/telemetry/protocols/teltonika/teltonikaIo.js";
import { enqueueTeltonikaRecords } from "../../src/services/telemetry/protocols/teltonika/tcpServer.js";
import { findActiveDeviceByImei } from "../../src/services/telemetry/protocols/teltonika/deviceByImei.js";

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
        // Data relativa: o vínculo é criado agora, e eventos anteriores ao
        // vínculo são recusados (409). Uma data fixa expira com o tempo.
        recorded_at: new Date().toISOString(),
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

test("Teltonika ponta a ponta: eventos de condução, iButton e relatório", { skip }, async () => {
  const fleet = await makeTelemetryTenant("drv");
  try {
    const imei = `35209${Date.now().toString().slice(-10)}`;
    const ibutton = "01A2B3C4D5E6F708";
    const motorista = await request(app)
      .post("/api/motoristas")
      .set(fleet.auth.authHeader)
      .send({ nome: "Motorista iButton", ibutton_id: ibutton.toLowerCase() });
    assert.equal(motorista.status, 201, motorista.body?.error);
    assert.equal(motorista.body.data.ibutton_id, ibutton);

    // iButton repetido no mesmo tenant é recusado.
    const dup = await request(app)
      .post("/api/motoristas")
      .set(fleet.auth.authHeader)
      .send({ nome: "Outro", ibutton_id: ibutton });
    assert.equal(dup.status, 409);

    const created = await request(app)
      .post("/api/telemetry/devices")
      .set(fleet.auth.authHeader)
      .send({
        external_id: `fmb-${imei}`,
        imei,
        protocol: "teltonika",
        caminhao_id: fleet.truck.id,
      });
    assert.equal(created.status, 201, created.body?.error);

    const now = Date.now();
    const at = (s) => new Date(now + s * 1000);
    const packet = buildAvlPacket({
      codecId: CODEC8,
      records: [
        {
          recordedAt: at(1),
          latitude: -25.4,
          longitude: -49.2,
          speedKmh: 70,
          ignition: true,
          odometerM: 500000,
          fuelUsedMl: 1_000_000, // contador acumulado: 1.000 L
          eventIoId: IO.GREEN_DRIVING_TYPE,
          io: {
            ones: [
              { id: IO.GREEN_DRIVING_TYPE, value: 2 },
              { id: IO.GREEN_DRIVING_VALUE, value: 52 },
              { id: IO.GSM_SIGNAL, value: 4 },
            ],
            twos: [{ id: IO.EXTERNAL_VOLTAGE_MV, value: 27400 }],
            eights: [{ id: IO.IBUTTON, value: ibutton }],
          },
        },
        {
          recordedAt: at(2),
          latitude: -25.41,
          longitude: -49.21,
          speedKmh: 98,
          ignition: true,
          odometerM: 520000,
          fuelUsedMl: 1_012_000, // +12 L em 20 km
          eventIoId: IO.OVERSPEEDING,
          // IOs permanentes (tensão, GSM, iButton) vêm em todo registro.
          io: {
            ones: [
              { id: IO.OVERSPEEDING, value: 98 },
              { id: IO.GSM_SIGNAL, value: 4 },
            ],
            twos: [{ id: IO.EXTERNAL_VOLTAGE_MV, value: 27400 }],
            eights: [{ id: IO.IBUTTON, value: ibutton }],
          },
        },
      ],
    });
    const parsed = tryParseAvlPacket(packet);
    const device = await findActiveDeviceByImei(imei);
    assert.ok(device, "device resolvido pelo IMEI");
    const accepted = await enqueueTeltonikaRecords(device, parsed.records, imei);
    assert.equal(accepted, 2);
    await waitForTelemetryQueueIdle();

    // Reenvio do mesmo pacote (aparelho sem ACK) não duplica eventos.
    await enqueueTeltonikaRecords(device, parsed.records, imei);
    await waitForTelemetryQueueIdle();

    const report = await request(app)
      .get("/api/telemetry/reports/driving")
      .query({
        from: new Date(now - 3600_000).toISOString(),
        to: new Date(now + 3600_000).toISOString(),
      })
      .set(fleet.auth.authHeader);
    assert.equal(report.status, 200, report.body?.error);
    assert.equal(report.body.data.totals.harsh_braking, 1);
    assert.equal(report.body.data.totals.overspeed, 1);
    assert.equal(report.body.data.events.length, 2);
    assert.ok(report.body.data.events.every((e) => e.motorista === "Motorista iButton"));
    assert.equal(report.body.data.drivers[0].behavior_events, 2);
    const veh = report.body.data.vehicles.find((v) => v.caminhao_id === fleet.truck.id);
    assert.equal(veh.behavior_events, 2);

    const current = await request(app)
      .get("/api/telemetry/current")
      .set(fleet.auth.authHeader);
    const row = current.body.data.find((r) => r.caminhao_id === fleet.truck.id);
    assert.equal(row.battery_v, 27.4);
    assert.equal(row.ibutton, ibutton);
    assert.equal(row.motorista_nome, "Motorista iButton");
    assert.equal(row.motorista_por_ibutton, true);

    const stored = await prisma.telemetry_events.findFirst({
      where: { device_id: device.id },
      orderBy: { registrado_em: "asc" },
    });
    assert.equal(stored.io[String(IO.GREEN_DRIVING_TYPE)], 2);
    assert.equal(stored.gsm_sinal, 4);

    // Resumo diário: consumo = diferença do contador (12 L), não o valor acumulado.
    const daily = await prisma.telemetry_daily.findMany({
      where: { caminhao_id: fleet.truck.id },
    });
    const dayKm = daily.reduce((a, d) => a + Number(d.km || 0), 0);
    const dayFuel = daily.reduce((a, d) => a + Number(d.fuel_consumed_l || 0), 0);
    assert.equal(dayKm, 20);
    assert.equal(dayFuel, 12);

    // Custo total por km: todos os gastos lançados do veículo ÷ km do rastreador.
    await prisma.gastos.create({
      data: {
        tenant_id: fleet.secondary.tenant.id,
        caminhao_id: fleet.truck.id,
        valor: 100,
        data_gasto: new Date(),
        descricao: "Pedágio teste",
      },
    });
    const eff = await request(app)
      .get("/api/telemetry/reports/efficiency")
      .set(fleet.auth.authHeader);
    assert.equal(eff.status, 200, eff.body?.error);
    const effVeh = eff.body.data.vehicles.find((v) => v.caminhao_id === fleet.truck.id);
    assert.equal(effVeh.km, 20);
    assert.equal(effVeh.total_cost, 100);
    assert.equal(effVeh.total_cost_per_km, 5);
  } finally {
    await prisma.gastos
      .deleteMany({ where: { tenant_id: fleet.secondary.tenant.id } })
      .catch(() => {});
    await prisma.telemetry_driving_events
      .deleteMany({ where: { tenant_id: fleet.secondary.tenant.id } })
      .catch(() => {});
    await cleanupTenant(fleet.secondary.tenant.id);
  }
});
