import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { cleanupTenant, createSecondaryTenantAdmin, loginWithCredentials } from "../helpers/dbTestFixtures.js";
import { waitForTelemetryQueueIdle } from "../../src/queues/telemetryJobQueue.js";
import {
  CODEC8_EXTENDED,
  buildAvlPacket,
  buildImeiHandshake,
} from "../../src/services/telemetry/protocols/teltonika/codec8.js";
import {
  CODEC12_RESPONSE,
  buildCodec12Command,
  tryParseCodec12,
} from "../../src/services/telemetry/protocols/teltonika/codec12.js";
import {
  pumpDeviceCommands,
  startTeltonikaTcpServer,
  stopTeltonikaTcpServer,
} from "../../src/services/telemetry/protocols/teltonika/tcpServer.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cliente TCP que se comporta como um rastreador Teltonika. */
function fakeTracker(port) {
  const socket = net.connect(port, "127.0.0.1");
  let buf = Buffer.alloc(0);
  socket.on("data", (c) => {
    buf = Buffer.concat([buf, c]);
  });
  const waitBytes = async (n, timeout = 5000) => {
    const t0 = Date.now();
    while (buf.length < n) {
      if (Date.now() - t0 > timeout) throw new Error(`timeout esperando ${n} bytes`);
      await sleep(20);
    }
    const out = buf.subarray(0, n);
    buf = buf.subarray(n);
    return out;
  };
  const waitCodec12 = async (timeout = 5000) => {
    const t0 = Date.now();
    for (;;) {
      const msg = buf.length >= 12 ? tryParseCodec12(buf) : null;
      if (msg) {
        buf = buf.subarray(msg.bytesConsumed);
        return msg;
      }
      if (Date.now() - t0 > timeout) throw new Error("timeout esperando comando");
      await sleep(20);
    }
  };
  return { socket, waitBytes, waitCodec12 };
}

test("bloqueio do motor: recusado em movimento, enviado parado, resposta gravada", { skip }, async () => {
  const stamp = `cmd${Date.now().toString(36)}`;
  const secondary = await createSecondaryTenantAdmin({
    slug: `tadm-${stamp}`,
    email: `tadm-${stamp}@saas.test`,
    nome: "Tel Commands",
    billingExempt: true,
    features: { telemetria: true, ordem_coleta: false, notas_estoque: false },
  });
  const auth = await loginWithCredentials(app, secondary.email, secondary.password);
  const truck = await prisma.caminhoes.create({
    data: { tenant_id: secondary.tenant.id, placa: `C${stamp.slice(-6)}`.toUpperCase().slice(0, 7), qtd_pneus: 6, km_atual: 1000, tipo_veiculo: "truck" },
  });
  const port = 40000 + Math.floor(Math.random() * 20000);
  process.env.TELETONIKA_TCP_ENABLED = "true";
  process.env.TELETONIKA_TCP_PORT = String(port);
  await startTeltonikaTcpServer();
  const imei = `35211${Date.now().toString().slice(-10)}`;
  const tracker = fakeTracker(port);
  try {
    const created = await request(app)
      .post("/api/telemetry/devices")
      .set(auth.authHeader)
      .send({ external_id: `fmc650-${imei}`, imei, protocol: "teltonika", model: "FMC650", caminhao_id: truck.id });
    assert.equal(created.status, 201, created.body?.error);

    tracker.socket.write(buildImeiHandshake(imei));
    assert.equal((await tracker.waitBytes(1))[0], 0x01);

    const send = async (speedKmh, offsetS) => {
      const packet = buildAvlPacket({
        codecId: CODEC8_EXTENDED,
        records: [{ recordedAt: new Date(Date.now() + offsetS * 1000), latitude: -25.4, longitude: -49.2, speedKmh, ignition: true }],
      });
      tracker.socket.write(packet);
      await tracker.waitBytes(4); // ACK
      await waitForTelemetryQueueIdle();
    };

    // Em movimento: o pedido de bloqueio é recusado.
    await send(72, 0);
    const moving = await request(app)
      .post("/api/telemetry/commands")
      .set(auth.authHeader)
      .send({ caminhao_id: truck.id, acao: "bloquear" });
    assert.equal(moving.status, 409);
    assert.match(moving.body.error || moving.body.message || "", /movimento/);

    // Parado: aceito, um por vez.
    await send(0, 1);
    const ok = await request(app)
      .post("/api/telemetry/commands")
      .set(auth.authHeader)
      .send({ caminhao_id: truck.id, acao: "bloquear" });
    assert.equal(ok.status, 201, ok.body?.error);
    assert.equal(ok.body.data.status, "pendente");
    assert.equal(ok.body.data.comando, "setdigout 1???");
    const busy = await request(app)
      .post("/api/telemetry/commands")
      .set(auth.authHeader)
      .send({ caminhao_id: truck.id, acao: "desbloquear" });
    assert.equal(busy.status, 409);

    // O gateway envia o Codec 12 ao aparelho conectado.
    await pumpDeviceCommands();
    const cmd = await tracker.waitCodec12();
    assert.equal(cmd.text, "setdigout 1???");
    tracker.socket.write(
      buildCodec12Command("DOUT1:1 DOUT2:IGNORED DOUT3:IGNORED DOUT4:IGNORED", CODEC12_RESPONSE),
    );
    let list;
    for (let i = 0; i < 50; i += 1) {
      list = await request(app).get("/api/telemetry/commands").query({ caminhao_id: truck.id }).set(auth.authHeader);
      if (list.body.data[0]?.status === "executado") break;
      await sleep(50);
    }
    assert.equal(list.body.data[0].status, "executado");
    assert.match(list.body.data[0].resposta, /DOUT1:1/);
    assert.ok(list.body.data[0].criado_por_nome);

    // Desbloquear é sempre permitido.
    const unblock = await request(app)
      .post("/api/telemetry/commands")
      .set(auth.authHeader)
      .send({ caminhao_id: truck.id, acao: "desbloquear" });
    assert.equal(unblock.status, 201, unblock.body?.error);
    await pumpDeviceCommands();
    assert.equal((await tracker.waitCodec12()).text, "setdigout 0???");
  } finally {
    tracker.socket.destroy();
    await stopTeltonikaTcpServer();
    delete process.env.TELETONIKA_TCP_ENABLED;
    delete process.env.TELETONIKA_TCP_PORT;
    await prisma.telemetry_device_commands.deleteMany({ where: { tenant_id: secondary.tenant.id } }).catch(() => {});
    await cleanupTenant(secondary.tenant.id);
  }
});
