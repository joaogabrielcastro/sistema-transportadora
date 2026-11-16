import net from "node:net";
import { logger } from "../../../../utils/logger.js";
import { enqueueTelemetryEvent } from "../../../../queues/telemetryJobQueue.js";
import { noteTelemetrySeen } from "../../telemetryIngestStatus.js";
import { touchDeviceLastSeen } from "../../telemetryDeviceAdmin.js";
import { resolveAssignmentAt } from "../../telemetryPrep.js";
import { TELEMETRY_MAX_SPEED_KMH } from "../../../../schemas/telemetrySchema.js";
import { findActiveDeviceByImei } from "./deviceByImei.js";
import {
  avlAck,
  buildTeltonikaEventId,
  imeiAcceptResponse,
  imeiRejectResponse,
  tryParseAvlPacket,
  tryParseImeiHandshake,
} from "./codec8.js";

const DEFAULT_PORT = 5027;
const MAX_BUFFER = 256 * 1024;
const SOCKET_IDLE_MS = 5 * 60 * 1000;
const MAX_PACKETS_PER_MINUTE = 120;

/** @type {import('node:net').Server | null} */
let server = null;
const status = {
  enabled: false,
  listening: false,
  port: null,
  acceptedConnections: 0,
  rejectedImei: 0,
  packetsAccepted: 0,
  lastError: null,
};

export function readTeltonikaTcpStatus() {
  return { ...status };
}

function envEnabled() {
  const raw = String(process.env.TELETONIKA_TCP_ENABLED || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function envPort() {
  const n = Number(process.env.TELETONIKA_TCP_PORT || DEFAULT_PORT);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_PORT;
}

export function isValidTeltonikaRecord(rec) {
  if (!rec) return false;
  const lat = Number(rec.latitude);
  const lng = Number(rec.longitude);
  const speed = Number(rec.speedKmh);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return false;
  }
  if (!Number.isFinite(speed) || speed < 0 || speed > TELEMETRY_MAX_SPEED_KMH) {
    return false;
  }
  return true;
}

/**
 * Enfileira records já autenticados pelo IMEI do device.
 * @param {object} device
 * @param {Array<{ recordedAt: Date, latitude: number, longitude: number, speedKmh: number, ignition: boolean, heading?: number|null, altitudeM?: number|null, odometerKm?: number|null }>} records
 * @param {string} imei
 */
export async function enqueueTeltonikaRecords(device, records, imei) {
  noteTelemetrySeen(device.id);
  await touchDeviceLastSeen(device.id);

  let accepted = 0;
  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i];
    if (!isValidTeltonikaRecord(rec)) continue;

    const assignment = await resolveAssignmentAt(device.id, rec.recordedAt);
    if (!assignment || Number(assignment.tenant_id) !== Number(device.tenant_id)) {
      logger.info("teltonika record skipped (no assignment)", {
        deviceId: device.id,
        imei,
      });
      continue;
    }

    const eventId = buildTeltonikaEventId(imei, rec.recordedAt, i);
    await enqueueTelemetryEvent({
      deviceId: device.id,
      eventId,
      recordedAt: rec.recordedAt.toISOString(),
      receivedAt: new Date().toISOString(),
      latitude: rec.latitude,
      longitude: rec.longitude,
      speedKmh: rec.speedKmh,
      ignition: Boolean(rec.ignition),
      heading: rec.heading ?? null,
      altitudeM: rec.altitudeM ?? null,
      odometerKm: rec.odometerKm ?? null,
      fuelConsumedL: rec.fuelConsumedL ?? null,
      fuelLevelPct: rec.fuelLevelPct ?? null,
    });
    accepted += 1;
  }
  return accepted;
}

function attachSocket(socket) {
  status.acceptedConnections += 1;
  let buffer = Buffer.alloc(0);
  let imei = null;
  /** @type {object | null} */
  let device = null;
  let packetsInWindow = 0;
  let windowStarted = Date.now();

  socket.setTimeout(SOCKET_IDLE_MS);
  socket.on("timeout", () => {
    socket.destroy();
  });

  socket.on("error", (err) => {
    logger.warn("teltonika socket error", { err: err?.message, imei });
  });

  let chain = Promise.resolve();

  socket.on("data", (chunk) => {
    chain = chain
      .then(async () => {
        if (socket.destroyed) return;
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > MAX_BUFFER) {
          socket.destroy();
          return;
        }

        const now = Date.now();
        if (now - windowStarted > 60_000) {
          windowStarted = now;
          packetsInWindow = 0;
        }

        if (!imei) {
          const handshake = tryParseImeiHandshake(buffer);
          if (!handshake) return;
          buffer = buffer.subarray(handshake.bytesConsumed);
          imei = handshake.imei;
          device = await findActiveDeviceByImei(imei);
          if (!device) {
            status.rejectedImei += 1;
            socket.write(imeiRejectResponse());
            socket.end();
            logger.info("teltonika imei rejected", { imei });
            return;
          }
          socket.write(imeiAcceptResponse());
          logger.info("teltonika imei accepted", {
            imei,
            deviceId: device.id,
            tenantId: device.tenant_id,
          });
        }

        while (buffer.length >= 12) {
          let packet;
          try {
            packet = tryParseAvlPacket(buffer);
          } catch (err) {
            status.lastError = String(err?.message || "parse").slice(0, 200);
            logger.warn("teltonika parse failed", {
              imei,
              err: err?.message,
              code: err?.code,
            });
            socket.destroy();
            return;
          }
          if (!packet) break;

          packetsInWindow += 1;
          if (packetsInWindow > MAX_PACKETS_PER_MINUTE) {
            logger.warn("teltonika rate limit", { imei });
            socket.destroy();
            return;
          }

          buffer = buffer.subarray(packet.bytesConsumed);
          const accepted = await enqueueTeltonikaRecords(
            device,
            packet.records,
            imei,
          );
          status.packetsAccepted += 1;
          socket.write(avlAck(packet.recordCount));
          logger.info("teltonika packet queued", {
            imei,
            deviceId: device.id,
            records: packet.recordCount,
            accepted,
          });
        }
      })
      .catch((err) => {
        status.lastError = String(err?.message || "handler").slice(0, 200);
        logger.error("teltonika handler failed", {
          imei,
          err: err?.message,
        });
        socket.destroy();
      });
  });
}

/**
 * Sobe o listener TCP Teltonika. No-op se TELETONIKA_TCP_ENABLED não estiver ligado.
 */
export async function startTeltonikaTcpServer() {
  if (server) return server;
  status.enabled = envEnabled();
  if (!status.enabled) {
    logger.info("Teltonika TCP desligado (TELETONIKA_TCP_ENABLED)");
    return null;
  }

  const port = envPort();
  status.port = port;

  server = net.createServer({ allowHalfOpen: false }, (socket) => {
    attachSocket(socket);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });

  status.listening = true;
  logger.info("Teltonika TCP listening", { port });
  return server;
}

export async function stopTeltonikaTcpServer() {
  if (!server) return;
  const current = server;
  server = null;
  status.listening = false;
  await new Promise((resolve) => {
    current.close(() => resolve());
  });
}
