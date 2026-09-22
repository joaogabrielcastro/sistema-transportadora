import { createHash } from "node:crypto";
import prisma from "../../lib/prisma.js";
import {
  assertDeviceCredentialAllowed,
  shouldAdvanceCurrentState,
} from "./telemetryPolicy.js";

export function hashDeviceCredential(raw) {
  return createHash("sha256").update(String(raw || ""), "utf8").digest("hex");
}

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function isUniqueViolation(err) {
  return err?.code === "P2002";
}

export async function createTelemetryDevice({
  tenantId,
  externalId,
  nome,
  credential,
}) {
  const secret = assertDeviceCredentialAllowed(credential);
  const tenant = Number(tenantId);
  if (!Number.isInteger(tenant) || tenant <= 0) {
    throw httpError("Tenant inválido.", 400, "TENANT_INVALID");
  }
  const external = String(externalId || "").trim();
  if (!external) {
    throw httpError("external_id é obrigatório.", 400, "DEVICE_EXTERNAL_ID");
  }

  return prisma.telemetry_devices.create({
    data: {
      tenant_id: tenant,
      external_id: external.slice(0, 64),
      nome: nome ? String(nome).slice(0, 120) : null,
      credential_hash: hashDeviceCredential(secret),
      ativo: true,
    },
  });
}

export async function revokeTelemetryDevice(tenantId, deviceId, at = new Date()) {
  const result = await prisma.telemetry_devices.updateMany({
    where: {
      id: Number(deviceId),
      tenant_id: Number(tenantId),
      revogado_em: null,
    },
    data: { ativo: false, revogado_em: at },
  });
  if (result.count !== 1) {
    throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");
  }
  return prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
  });
}

/** Troca o segredo sem apagar o dispositivo e sem reativar um revogado. */
export async function rotateTelemetryCredential(tenantId, deviceId, credential) {
  const secret = assertDeviceCredentialAllowed(credential);
  const result = await prisma.telemetry_devices.updateMany({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
    data: { credential_hash: hashDeviceCredential(secret) },
  });
  if (result.count !== 1) {
    throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");
  }
  return prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
  });
}

/**
 * Resolve o dispositivo pela credencial. O tenant é o da linha, não um argumento.
 */
export async function resolveDeviceByCredential(credential) {
  const secret = String(credential || "");
  if (!secret) return null;
  const device = await prisma.telemetry_devices.findUnique({
    where: { credential_hash: hashDeviceCredential(secret) },
  });
  if (!device || device.ativo !== true || device.revogado_em) return null;
  return device;
}

async function closeOpenAssignment(where, fimEm) {
  await prisma.telemetry_device_assignments.updateMany({
    where: { ...where, fim_em: null },
    data: { fim_em: fimEm },
  });
}

/**
 * Encerra o vínculo aberto e cria outro. A linha antiga permanece.
 * Tenant do dispositivo e do veículo precisam ser o mesmo.
 */
export async function assignTelemetryDevice({
  tenantId,
  deviceId,
  caminhaoId,
  inicioEm = new Date(),
}) {
  const tenant = Number(tenantId);
  const device = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: tenant },
  });
  if (!device) {
    throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");
  }
  if (device.revogado_em || device.ativo !== true) {
    throw httpError("Dispositivo revogado.", 403, "DEVICE_REVOKED");
  }
  const caminhao = await prisma.caminhoes.findFirst({
    where: { id: Number(caminhaoId), tenant_id: tenant },
  });
  if (!caminhao) {
    throw httpError("Veículo não encontrado.", 404, "VEHICLE_NOT_FOUND");
  }

  const start = new Date(inicioEm);
  await closeOpenAssignment({ device_id: device.id, tenant_id: tenant }, start);
  await closeOpenAssignment({ caminhao_id: caminhao.id, tenant_id: tenant }, start);

  try {
    return await prisma.telemetry_device_assignments.create({
      data: {
        tenant_id: tenant,
        device_id: device.id,
        caminhao_id: caminhao.id,
        inicio_em: start,
        fim_em: null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw httpError(
        "Já existe vínculo ativo para este dispositivo ou veículo.",
        409,
        "ASSIGNMENT_OPEN",
      );
    }
    throw err;
  }
}

export async function resolveAssignmentAt(deviceId, at) {
  const when = new Date(at);
  return prisma.telemetry_device_assignments.findFirst({
    where: {
      device_id: Number(deviceId),
      inicio_em: { lte: when },
      OR: [{ fim_em: null }, { fim_em: { gt: when } }],
    },
    orderBy: { inicio_em: "desc" },
  });
}

/**
 * Grava o evento uma vez. Duplicata (mesmo device_id + event_id) devolve a linha
 * existente. tenant_id e caminhao_id do payload não escolhem o dono.
 */
export async function recordTelemetryEvent({
  deviceId,
  eventId,
  registradoEm,
  recebidoEm,
  latitude = null,
  longitude = null,
  velocidadeKmh = null,
  odometroKm = null,
  payloadTenantId = undefined,
  payloadCaminhaoId = undefined,
}) {
  const eventKey = String(eventId || "").trim();
  if (!eventKey) {
    throw httpError("event_id é obrigatório.", 400, "EVENT_ID_REQUIRED");
  }
  const device = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId) },
  });
  if (!device || device.ativo !== true || device.revogado_em) {
    throw httpError("Dispositivo revogado ou inexistente.", 403, "DEVICE_REVOKED");
  }
  if (
    payloadTenantId != null &&
    Number(payloadTenantId) !== Number(device.tenant_id)
  ) {
    throw httpError(
      "tenant_id do payload é ignorado e não pode divergir do dispositivo.",
      403,
      "TENANT_FROM_DEVICE",
    );
  }

  const recorded = new Date(registradoEm);
  const received = new Date(recebidoEm || Date.now());
  const assignment = await resolveAssignmentAt(device.id, recorded);
  const caminhaoId = assignment?.caminhao_id ?? null;
  if (
    payloadCaminhaoId != null &&
    Number(payloadCaminhaoId) !== Number(caminhaoId)
  ) {
    throw httpError(
      "vehicle_id do payload não pode escolher o veículo.",
      403,
      "VEHICLE_FROM_ASSIGNMENT",
    );
  }

  const data = {
    tenant_id: device.tenant_id,
    device_id: device.id,
    caminhao_id: caminhaoId,
    event_id: eventKey.slice(0, 80),
    registrado_em: recorded,
    recebido_em: received,
    latitude,
    longitude,
    velocidade_kmh: velocidadeKmh,
    odometro_km: odometroKm,
  };

  try {
    const event = await prisma.telemetry_events.create({ data });
    return { inserted: true, duplicate: false, event };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const event = await prisma.telemetry_events.findFirst({
      where: { device_id: device.id, event_id: data.event_id },
    });
    return { inserted: false, duplicate: true, event };
  }
}

/**
 * Atualiza a linha de estado atual somente se registrado_em for mais novo.
 */
export async function advanceCurrentState({
  tenantId,
  caminhaoId,
  deviceId = null,
  registradoEm,
  recebidoEm,
  latitude = null,
  longitude = null,
  velocidadeKmh = null,
  odometroKm = null,
}) {
  const tenant = Number(tenantId);
  const vehicleId = Number(caminhaoId);
  const recorded = new Date(registradoEm);
  const received = new Date(recebidoEm || Date.now());
  const caminhao = await prisma.caminhoes.findFirst({
    where: { id: vehicleId, tenant_id: tenant },
    select: { id: true },
  });
  if (!caminhao) {
    throw httpError("Veículo não encontrado.", 404, "VEHICLE_NOT_FOUND");
  }

  const existing = await prisma.telemetry_current_state.findUnique({
    where: { caminhao_id: vehicleId },
  });

  const patch = {
    device_id: deviceId != null ? Number(deviceId) : null,
    registrado_em: recorded,
    recebido_em: received,
    latitude,
    longitude,
    velocidade_kmh: velocidadeKmh,
    odometro_km: odometroKm,
  };

  if (!existing) {
    try {
      const state = await prisma.telemetry_current_state.create({
        data: { tenant_id: tenant, caminhao_id: vehicleId, ...patch },
      });
      return { advanced: true, state };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  if (existing && !shouldAdvanceCurrentState(existing.registrado_em, recorded)) {
    return { advanced: false, state: existing };
  }

  const updated = await prisma.telemetry_current_state.updateMany({
    where: {
      caminhao_id: vehicleId,
      tenant_id: tenant,
      registrado_em: { lt: recorded },
    },
    data: patch,
  });
  const state = await prisma.telemetry_current_state.findUnique({
    where: { caminhao_id: vehicleId },
  });
  return { advanced: updated.count > 0, state };
}

/**
 * Persiste o ponto já autenticado. A constraint (device_id, event_id) é a
 * idempotência. O estado atual usa a linha gravada e só avança se o relógio
 * do aparelho for estritamente mais novo. Tenant e veículo vêm do banco.
 */
export async function applyIngestedTelemetryEvent({
  deviceId,
  eventId,
  recordedAt,
  receivedAt,
  latitude,
  longitude,
  speedKmh,
  ignition,
}) {
  const device = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId) },
  });
  if (!device || device.ativo !== true || device.revogado_em) {
    return { skipped: true, reason: "revoked" };
  }

  const eventKey = String(eventId || "").trim().slice(0, 80);
  if (!eventKey) {
    throw httpError("event_id é obrigatório.", 400, "EVENT_ID_REQUIRED");
  }

  const recorded = new Date(recordedAt);
  const received = new Date(receivedAt || Date.now());
  const assignment = await resolveAssignmentAt(device.id, recorded);
  if (!assignment || Number(assignment.tenant_id) !== Number(device.tenant_id)) {
    return { skipped: true, reason: "no_assignment" };
  }

  return prisma.$transaction(async (tx) => {
    const insertedRows = await tx.$queryRaw`
      INSERT INTO telemetry_events (
        tenant_id, device_id, caminhao_id, event_id,
        registrado_em, recebido_em,
        latitude, longitude, velocidade_kmh, ignicao
      ) VALUES (
        ${device.tenant_id},
        ${device.id},
        ${assignment.caminhao_id},
        ${eventKey},
        ${recorded},
        ${received},
        ${latitude},
        ${longitude},
        ${speedKmh},
        ${ignition}
      )
      ON CONFLICT (device_id, event_id) DO NOTHING
      RETURNING id
    `;
    const inserted = Array.isArray(insertedRows) && insertedRows.length > 0;

    await tx.$executeRaw`
      INSERT INTO telemetry_current_state (
        tenant_id, caminhao_id, device_id,
        registrado_em, recebido_em,
        latitude, longitude, velocidade_kmh, ignicao, atualizado_em
      )
      SELECT
        e.tenant_id, e.caminhao_id, e.device_id,
        e.registrado_em, e.recebido_em,
        e.latitude, e.longitude, e.velocidade_kmh, e.ignicao, NOW()
      FROM telemetry_events e
      WHERE e.device_id = ${device.id}
        AND e.event_id = ${eventKey}
        AND e.caminhao_id IS NOT NULL
      ON CONFLICT (caminhao_id) DO UPDATE SET
        device_id = EXCLUDED.device_id,
        registrado_em = EXCLUDED.registrado_em,
        recebido_em = EXCLUDED.recebido_em,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        velocidade_kmh = EXCLUDED.velocidade_kmh,
        ignicao = EXCLUDED.ignicao,
        atualizado_em = NOW()
      WHERE telemetry_current_state.tenant_id = EXCLUDED.tenant_id
        AND telemetry_current_state.registrado_em < EXCLUDED.registrado_em
    `;

    return { inserted, duplicate: !inserted, skipped: false };
  });
}
