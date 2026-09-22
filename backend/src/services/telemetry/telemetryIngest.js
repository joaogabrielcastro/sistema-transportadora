import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { assertDeviceCredentialAllowed } from "./telemetryPolicy.js";
import { resolveAssignmentAt, resolveDeviceByCredential } from "./telemetryPrep.js";
import { enqueueTelemetryEvent } from "../../queues/telemetryJobQueue.js";
import { noteTelemetrySeen } from "./telemetryIngestStatus.js";

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Credencial no esquema Device, separado de Bearer (JWT / API_TOKEN).
 * O valor não entra em log.
 */
export function readDeviceCredential(authorizationHeader) {
  const header = String(authorizationHeader || "").trim();
  if (!header) {
    throw httpError("Credencial de dispositivo é obrigatória.", 401, "DEVICE_AUTH_REQUIRED");
  }
  if (/^bearer\s+/i.test(header)) {
    throw httpError(
      "JWT e API_TOKEN não autenticam rastreador.",
      401,
      "DEVICE_CREDENTIAL_REJECTED",
    );
  }
  const match = /^Device\s+(\S+)$/i.exec(header);
  if (!match) {
    throw httpError("Credencial de dispositivo é obrigatória.", 401, "DEVICE_AUTH_REQUIRED");
  }
  return match[1];
}

/**
 * Valida a credencial, resolve tenant e veículo no banco e enfileira.
 * Não grava o evento aqui: o worker persiste com a constraint única.
 */
export async function acceptTelemetryIngest({ authorization, event }) {
  let credential;
  try {
    credential = readDeviceCredential(authorization);
    assertDeviceCredentialAllowed(credential);
  } catch (err) {
    if (err?.code === "DEVICE_CREDENTIAL_REJECTED" || err?.statusCode === 400) {
      throw httpError(
        "Credencial de dispositivo recusada.",
        401,
        "DEVICE_CREDENTIAL_REJECTED",
      );
    }
    throw err;
  }

  const device = await resolveDeviceByCredential(credential);
  if (!device) {
    throw httpError("Credencial inválida.", 401, "DEVICE_AUTH_FAILED");
  }

  noteTelemetrySeen(device.id);
  logger.info("telemetry event received", {
    deviceId: device.id,
    eventId: event.event_id,
    tenantId: device.tenant_id,
  });

  const recorded = new Date(event.recorded_at);
  const assignment = await resolveAssignmentAt(device.id, recorded);
  if (!assignment || Number(assignment.tenant_id) !== Number(device.tenant_id)) {
    throw httpError(
      "Dispositivo sem veículo vinculado neste horário.",
      409,
      "ASSIGNMENT_REQUIRED",
    );
  }

  const already = await prisma.telemetry_events.findFirst({
    where: { device_id: device.id, event_id: event.event_id },
    select: { id: true },
  });
  if (already) {
    return { duplicate: true, queued: false, eventId: event.event_id };
  }

  const queued = await enqueueTelemetryEvent({
    deviceId: device.id,
    eventId: event.event_id,
    recordedAt: recorded.toISOString(),
    receivedAt: new Date().toISOString(),
    latitude: event.latitude,
    longitude: event.longitude,
    speedKmh: event.speed_kmh,
    ignition: event.ignition,
  });

  return {
    duplicate: queued.duplicate === true,
    queued: queued.queued !== false && queued.duplicate !== true,
    eventId: event.event_id,
  };
}
