import { randomBytes } from "node:crypto";
import { isFmsModel } from "./protocols/teltonika/teltonikaIo.js";
import prisma from "../../lib/prisma.js";
import {
  assignTelemetryDevice,
  createTelemetryDevice,
  revokeTelemetryDevice,
  rotateTelemetryCredential,
} from "./telemetryPrep.js";
import {
  RAW_EVENT_RETENTION_DAYS,
  assertSeatAvailable,
} from "./telemetryPolicy.js";

/** Sem comunicação há mais de 15 min → offline. */
export const TELEMETRY_OFFLINE_AFTER_MS = 15 * 60 * 1000;

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export function generateDeviceCredential() {
  return randomBytes(32).toString("base64url");
}

export function connectionStatusFor(device, now = new Date()) {
  if (!device?.ativo || device.revogado_em) return "revoked";
  if (!device.last_seen_at) return "awaiting";
  const seen = new Date(device.last_seen_at).getTime();
  if (!Number.isFinite(seen)) return "awaiting";
  if (now.getTime() - seen > TELEMETRY_OFFLINE_AFTER_MS) return "offline";
  return "online";
}

/** Nunca expõe credential_hash. */
export function serializeTelemetryDevice(device, { openAssignment = null } = {}) {
  if (!device) return null;
  return {
    id: device.id,
    tenant_id: device.tenant_id,
    external_id: device.external_id,
    nome: device.nome,
    manufacturer: device.manufacturer ?? null,
    model: device.model ?? null,
    imei: device.imei ?? null,
    protocol: device.protocol ?? null,
    connection_type: device.connection_type ?? null,
    ownership_type: device.ownership_type ?? null,
    ativo: device.ativo,
    revogado_em: device.revogado_em,
    last_seen_at: device.last_seen_at,
    connection_status: connectionStatusFor(device),
    criado_em: device.criado_em,
    atualizado_em: device.atualizado_em,
    assignment: openAssignment
      ? {
          id: openAssignment.id,
          caminhao_id: openAssignment.caminhao_id,
          inicio_em: openAssignment.inicio_em,
          placa: openAssignment.caminhoes?.placa ?? null,
        }
      : null,
  };
}

async function loadOpenAssignment(tenantId, deviceId) {
  return prisma.telemetry_device_assignments.findFirst({
    where: {
      tenant_id: Number(tenantId),
      device_id: Number(deviceId),
      fim_em: null,
    },
    include: { caminhoes: { select: { id: true, placa: true } } },
  });
}

export async function listTelemetryDevices(tenantId, { ativo } = {}) {
  const where = { tenant_id: Number(tenantId) };
  if (ativo === true || ativo === false) where.ativo = ativo;

  const devices = await prisma.telemetry_devices.findMany({
    where,
    orderBy: [{ ativo: "desc" }, { id: "desc" }],
  });

  const open = await prisma.telemetry_device_assignments.findMany({
    where: {
      tenant_id: Number(tenantId),
      device_id: { in: devices.map((d) => d.id) },
      fim_em: null,
    },
    include: { caminhoes: { select: { id: true, placa: true } } },
  });
  const byDevice = new Map(open.map((a) => [a.device_id, a]));

  return devices.map((d) =>
    serializeTelemetryDevice(d, { openAssignment: byDevice.get(d.id) || null }),
  );
}

export async function getTelemetryDevice(tenantId, deviceId) {
  const device = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
  });
  if (!device) throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");
  const assignment = await loadOpenAssignment(tenantId, device.id);
  return serializeTelemetryDevice(device, { openAssignment: assignment });
}

export async function createTelemetryDeviceForTenant(tenantId, body) {
  await assertSeatAvailable(tenantId);
  const credential = body.credential || generateDeviceCredential();
  const device = await createTelemetryDevice({
    tenantId,
    externalId: body.external_id,
    nome: body.nome,
    credential,
    manufacturer: body.manufacturer ?? null,
    model: body.model ?? null,
    imei: body.imei ?? null,
    protocol: body.protocol ?? "http_json",
    connectionType: body.connection_type ?? null,
    ownershipType: body.ownership_type ?? "CUSTOMER",
  });

  let assignment = null;
  if (body.caminhao_id) {
    await assignTelemetryDevice({
      tenantId,
      deviceId: device.id,
      caminhaoId: body.caminhao_id,
    });
    assignment = await loadOpenAssignment(tenantId, device.id);
  }

  return {
    device: serializeTelemetryDevice(device, { openAssignment: assignment }),
    /** Segredo em claro — só nesta resposta. */
    credential,
  };
}

export async function updateTelemetryDeviceForTenant(tenantId, deviceId, body) {
  const existing = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
  });
  if (!existing) {
    throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");
  }
  if (existing.revogado_em && body.ativo === true) {
    throw httpError(
      "Dispositivo revogado não pode ser reativado. Cadastre outro.",
      409,
      "DEVICE_REVOKED",
    );
  }

  const data = {};
  for (const key of [
    "nome",
    "manufacturer",
    "model",
    "imei",
    "protocol",
    "connection_type",
    "ownership_type",
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      data[key] = body[key];
    }
  }
  if (typeof body.ativo === "boolean") {
    data.ativo = body.ativo;
  }

  const updated = await prisma.telemetry_devices.update({
    where: { id: existing.id },
    data,
  });
  const assignment = await loadOpenAssignment(tenantId, updated.id);
  return serializeTelemetryDevice(updated, { openAssignment: assignment });
}

export async function assignDeviceForTenant(tenantId, deviceId, body) {
  await assignTelemetryDevice({
    tenantId,
    deviceId,
    caminhaoId: body.caminhao_id,
    inicioEm: body.inicio_em ? new Date(body.inicio_em) : new Date(),
  });
  return getTelemetryDevice(tenantId, deviceId);
}

export async function unassignDeviceForTenant(tenantId, deviceId, at = new Date()) {
  const device = await prisma.telemetry_devices.findFirst({
    where: { id: Number(deviceId), tenant_id: Number(tenantId) },
    select: { id: true },
  });
  if (!device) throw httpError("Dispositivo não encontrado.", 404, "DEVICE_NOT_FOUND");

  const result = await prisma.telemetry_device_assignments.updateMany({
    where: {
      tenant_id: Number(tenantId),
      device_id: device.id,
      fim_em: null,
    },
    data: { fim_em: at },
  });
  if (result.count === 0) {
    throw httpError("Dispositivo sem vínculo ativo.", 409, "ASSIGNMENT_MISSING");
  }
  return getTelemetryDevice(tenantId, deviceId);
}

export async function revokeDeviceForTenant(tenantId, deviceId) {
  const at = new Date();
  await prisma.telemetry_device_assignments.updateMany({
    where: {
      tenant_id: Number(tenantId),
      device_id: Number(deviceId),
      fim_em: null,
    },
    data: { fim_em: at },
  });
  await revokeTelemetryDevice(tenantId, deviceId, at);
  return getTelemetryDevice(tenantId, deviceId);
}

export async function rotateCredentialForTenant(tenantId, deviceId, body = {}) {
  const credential = body.credential || generateDeviceCredential();
  await rotateTelemetryCredential(tenantId, deviceId, credential);
  const device = await getTelemetryDevice(tenantId, deviceId);
  return { device, credential };
}

export async function listCurrentStates(tenantId, { caminhaoId } = {}) {
  const where = { tenant_id: Number(tenantId) };
  if (caminhaoId) where.caminhao_id = Number(caminhaoId);

  const rows = await prisma.telemetry_current_state.findMany({
    where,
    include: {
      caminhoes: { select: { id: true, placa: true, motorista_id: true } },
      devices: {
        select: {
          id: true,
          external_id: true,
          nome: true,
          last_seen_at: true,
          ativo: true,
          revogado_em: true,
          model: true,
          protocol: true,
        },
      },
    },
    orderBy: { registrado_em: "desc" },
  });

  // Motorista do último ponto (iButton) ou o vinculado ao veículo.
  const motoristaIds = [
    ...new Set(
      rows
        .map((r) => r.motorista_id ?? r.caminhoes?.motorista_id)
        .filter((id) => id != null),
    ),
  ];
  const motoristas = motoristaIds.length
    ? await prisma.motoristas.findMany({
        where: { tenant_id: Number(tenantId), id: { in: motoristaIds } },
        select: { id: true, nome: true },
      })
    : [];
  const nomeMotorista = new Map(motoristas.map((m) => [m.id, m.nome]));

  return rows.map((row) => ({
    caminhao_id: row.caminhao_id,
    placa: row.caminhoes?.placa ?? null,
    device_id: row.device_id,
    device_external_id: row.devices?.external_id ?? null,
    connection_status: connectionStatusFor(row.devices || {}),
    registrado_em: row.registrado_em,
    recebido_em: row.recebido_em,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    velocidade_kmh: row.velocidade_kmh != null ? Number(row.velocidade_kmh) : null,
    heading: row.heading != null ? Number(row.heading) : null,
    odometro_km: row.odometro_km != null ? Number(row.odometro_km) : null,
    ignicao: row.ignicao,
    engine_rpm: row.engine_rpm != null ? Number(row.engine_rpm) : null,
    fuel_level_pct:
      row.fuel_level_pct != null ? Number(row.fuel_level_pct) : null,
    fuel_consumed_l:
      row.fuel_consumed_l != null ? Number(row.fuel_consumed_l) : null,
    // "can" = medido pelo caminhão (FMS); "gps" = estimado pelo rastreador.
    fuel_source: isFmsModel(row.devices?.model) ? "can" : "gps",
    device_model: row.devices?.model ?? null,
    // Bloqueio/desbloqueio por comando (Codec 12) só em rastreadores Teltonika.
    commands_supported: String(row.devices?.protocol || "").toLowerCase() === "teltonika",
    engine_temp_c:
      row.engine_temp_c != null ? Number(row.engine_temp_c) : null,
    engine_hours: row.engine_hours != null ? Number(row.engine_hours) : null,
    battery_v: row.battery_v != null ? Number(row.battery_v) : null,
    satelites: row.satelites ?? null,
    gsm_sinal: row.gsm_sinal ?? null,
    ibutton: row.ibutton ?? null,
    motorista_id: row.motorista_id ?? row.caminhoes?.motorista_id ?? null,
    motorista_nome:
      nomeMotorista.get(row.motorista_id ?? row.caminhoes?.motorista_id) ?? null,
    motorista_por_ibutton: Boolean(row.ibutton && row.motorista_id),
    last_seen_at: row.devices?.last_seen_at ?? null,
  }));
}

export async function listHistory(tenantId, { caminhaoId, from, to, limit }) {
  const truck = await prisma.caminhoes.findFirst({
    where: { id: Number(caminhaoId), tenant_id: Number(tenantId) },
    select: { id: true, placa: true },
  });
  if (!truck) throw httpError("Veículo não encontrado.", 404, "VEHICLE_NOT_FOUND");

  const registrado = {};
  if (from) registrado.gte = new Date(from);
  if (to) registrado.lte = new Date(to);

  const events = await prisma.telemetry_events.findMany({
    where: {
      tenant_id: Number(tenantId),
      caminhao_id: truck.id,
      ...(Object.keys(registrado).length ? { registrado_em: registrado } : {}),
    },
    orderBy: { registrado_em: "asc" },
    take: limit,
    select: {
      id: true,
      device_id: true,
      event_id: true,
      registrado_em: true,
      recebido_em: true,
      latitude: true,
      longitude: true,
      velocidade_kmh: true,
      heading: true,
      odometro_km: true,
      fuel_consumed_l: true,
      fuel_level_pct: true,
      ignicao: true,
    },
  });

  const mapped = events.map((e) => ({
    id: String(e.id),
    device_id: e.device_id,
    event_id: e.event_id,
    registrado_em: e.registrado_em,
    recebido_em: e.recebido_em,
    latitude: e.latitude != null ? Number(e.latitude) : null,
    longitude: e.longitude != null ? Number(e.longitude) : null,
    velocidade_kmh: e.velocidade_kmh != null ? Number(e.velocidade_kmh) : null,
    heading: e.heading != null ? Number(e.heading) : null,
    odometro_km: e.odometro_km != null ? Number(e.odometro_km) : null,
    fuel_consumed_l:
      e.fuel_consumed_l != null ? Number(e.fuel_consumed_l) : null,
    fuel_level_pct:
      e.fuel_level_pct != null ? Number(e.fuel_level_pct) : null,
    ignicao: e.ignicao,
  }));

  const withOdo = mapped.filter((e) => e.odometro_km != null);
  const withFuel = mapped.filter((e) => e.fuel_consumed_l != null);
  let periodKm = null;
  let periodFuelL = null;
  let periodKmPerL = null;
  if (withOdo.length >= 2) {
    periodKm = Math.max(
      0,
      withOdo[withOdo.length - 1].odometro_km - withOdo[0].odometro_km,
    );
  }
  if (withFuel.length >= 2) {
    periodFuelL = Math.max(
      0,
      withFuel[withFuel.length - 1].fuel_consumed_l - withFuel[0].fuel_consumed_l,
    );
  }
  if (periodKm != null && periodFuelL != null && periodFuelL > 0.05) {
    periodKmPerL = periodKm / periodFuelL;
  }

  return {
    caminhao_id: truck.id,
    placa: truck.placa,
    retention_days: RAW_EVENT_RETENTION_DAYS,
    count: events.length,
    period_km: periodKm,
    period_fuel_l: periodFuelL,
    period_km_per_l: periodKmPerL,
    events: mapped,
  };
}

export async function touchDeviceLastSeen(deviceId, at = new Date()) {
  if (deviceId == null) return;
  await prisma.telemetry_devices.updateMany({
    where: { id: Number(deviceId), ativo: true, revogado_em: null },
    data: { last_seen_at: at },
  });
}
