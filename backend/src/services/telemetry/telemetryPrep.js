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
  manufacturer = null,
  model = null,
  imei = null,
  protocol = null,
  connectionType = null,
  ownershipType = null,
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
      manufacturer: manufacturer ? String(manufacturer).slice(0, 64) : null,
      model: model ? String(model).slice(0, 64) : null,
      imei: imei ? String(imei).slice(0, 32) : null,
      protocol: protocol ? String(protocol).slice(0, 32) : null,
      connection_type: connectionType
        ? String(connectionType).slice(0, 32)
        : null,
      ownership_type: ownershipType
        ? String(ownershipType).slice(0, 16)
        : null,
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
  heading = null,
  altitudeM = null,
  odometerKm = null,
  engineRpm = null,
  fuelLevelPct = null,
  fuelConsumedL = null,
  engineTempC = null,
  engineHours = null,
  batteryV = null,
  satellites = null,
  gsmSignal = null,
  ibutton = null,
  io = null,
  drivingEvents = [],
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

  const motoristaId = await resolveMotoristaForEvent({
    tenantId: device.tenant_id,
    caminhaoId: assignment.caminhao_id,
    ibutton,
  });
  const ioJson = io && typeof io === "object" ? JSON.stringify(io) : null;

  const result = await prisma.$transaction(async (tx) => {
    const insertedRows = await tx.$queryRaw`
      INSERT INTO telemetry_events (
        tenant_id, device_id, caminhao_id, event_id,
        registrado_em, recebido_em,
        latitude, longitude, velocidade_kmh, heading, altitude_m,
        odometro_km, ignicao,
        engine_rpm, fuel_level_pct, fuel_consumed_l,
        engine_temp_c, engine_hours, battery_v,
        io, satelites, gsm_sinal, ibutton, motorista_id
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
        ${heading},
        ${altitudeM},
        ${odometerKm},
        ${ignition},
        ${engineRpm},
        ${fuelLevelPct},
        ${fuelConsumedL},
        ${engineTempC},
        ${engineHours},
        ${batteryV},
        ${ioJson}::jsonb,
        ${satellites},
        ${gsmSignal},
        ${ibutton},
        ${motoristaId}
      )
      ON CONFLICT (device_id, event_id) DO NOTHING
      RETURNING id
    `;
    const inserted = Array.isArray(insertedRows) && insertedRows.length > 0;

    await tx.$executeRaw`
      INSERT INTO telemetry_current_state (
        tenant_id, caminhao_id, device_id,
        registrado_em, recebido_em,
        latitude, longitude, velocidade_kmh, heading, altitude_m,
        odometro_km, ignicao,
        engine_rpm, fuel_level_pct, fuel_consumed_l,
        engine_temp_c, engine_hours, battery_v,
        satelites, gsm_sinal, ibutton, motorista_id, atualizado_em
      )
      SELECT
        e.tenant_id, e.caminhao_id, e.device_id,
        e.registrado_em, e.recebido_em,
        e.latitude, e.longitude, e.velocidade_kmh, e.heading, e.altitude_m,
        e.odometro_km, e.ignicao,
        e.engine_rpm, e.fuel_level_pct, e.fuel_consumed_l,
        e.engine_temp_c, e.engine_hours, e.battery_v,
        e.satelites, e.gsm_sinal, e.ibutton, e.motorista_id, NOW()
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
        heading = EXCLUDED.heading,
        altitude_m = EXCLUDED.altitude_m,
        odometro_km = EXCLUDED.odometro_km,
        ignicao = EXCLUDED.ignicao,
        engine_rpm = EXCLUDED.engine_rpm,
        fuel_level_pct = EXCLUDED.fuel_level_pct,
        fuel_consumed_l = EXCLUDED.fuel_consumed_l,
        engine_temp_c = EXCLUDED.engine_temp_c,
        engine_hours = EXCLUDED.engine_hours,
        battery_v = EXCLUDED.battery_v,
        satelites = EXCLUDED.satelites,
        gsm_sinal = EXCLUDED.gsm_sinal,
        ibutton = EXCLUDED.ibutton,
        motorista_id = EXCLUDED.motorista_id,
        atualizado_em = NOW()
      WHERE telemetry_current_state.tenant_id = EXCLUDED.tenant_id
        AND telemetry_current_state.registrado_em < EXCLUDED.registrado_em
    `;

    if (inserted && Array.isArray(drivingEvents) && drivingEvents.length) {
      for (const ev of drivingEvents) {
        if (!ev?.tipo) continue;
        await tx.$executeRaw`
          INSERT INTO telemetry_driving_events (
            tenant_id, device_id, caminhao_id, motorista_id, event_key, tipo,
            valor, velocidade_kmh, latitude, longitude, ocorrido_em
          ) VALUES (
            ${device.tenant_id}, ${device.id}, ${assignment.caminhao_id}, ${motoristaId},
            ${`${eventKey}:${ev.tipo}`.slice(0, 100)}, ${String(ev.tipo).slice(0, 32)},
            ${ev.valor ?? null}, ${speedKmh}, ${latitude}, ${longitude}, ${recorded}
          )
          ON CONFLICT (device_id, event_key) DO NOTHING
        `;
      }
    }

    return { inserted, duplicate: !inserted, skipped: false };
  });

  if (result.inserted) {
    try {
      await upsertTelemetryDaily({
        tenantId: device.tenant_id,
        caminhaoId: assignment.caminhao_id,
        recordedAt: recorded,
      });
    } catch {
      // daily não bloqueia ingestão
    }
  }

  return result;
}

/**
 * Motorista do ponto: iButton lido (FMB130) tem prioridade; senão, o motorista
 * vinculado ao veículo no cadastro.
 */
async function resolveMotoristaForEvent({ tenantId, caminhaoId, ibutton }) {
  try {
    if (ibutton) {
      const byIbutton = await prisma.motoristas.findFirst({
        where: { tenant_id: Number(tenantId), ibutton_id: String(ibutton) },
        select: { id: true },
      });
      if (byIbutton) return byIbutton.id;
    }
    const truck = await prisma.caminhoes.findFirst({
      where: { id: Number(caminhaoId), tenant_id: Number(tenantId) },
      select: { motorista_id: true },
    });
    return truck?.motorista_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resumo diário por veículo, RECALCULADO a partir dos pontos do dia.
 *
 * Hodômetro e combustível do rastreador são contadores acumulados: o valor
 * do dia é (última leitura do dia − última leitura antes do dia), por
 * aparelho. Recalcular em vez de somar diferenças torna o resumo correto
 * mesmo com registros fora de ordem, reenvios e a fila processando pontos do
 * mesmo veículo em paralelo. Contador que volta (troca/reset do aparelho)
 * usa só a variação dentro do dia, nunca valor negativo.
 */
async function upsertTelemetryDaily({ tenantId, caminhaoId, recordedAt }) {
  const day = new Date(recordedAt);
  const dayStart = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const tid = Number(tenantId);
  const cid = Number(caminhaoId);

  const rows = await prisma.$queryRaw`
    WITH d AS (
      SELECT device_id,
             MAX(odometro_km) AS mx_o, MIN(odometro_km) AS mn_o,
             MAX(fuel_consumed_l) AS mx_f, MIN(fuel_consumed_l) AS mn_f,
             MAX(velocidade_kmh) AS vmax, MAX(engine_hours) AS eh,
             COUNT(*)::int AS n
        FROM telemetry_events
       WHERE caminhao_id = ${cid}
         AND registrado_em >= ${dayStart} AND registrado_em < ${dayEnd}
       GROUP BY device_id
    )
    SELECT d.*,
      (SELECT p.odometro_km FROM telemetry_events p
        WHERE p.device_id = d.device_id AND p.caminhao_id = ${cid}
          AND p.registrado_em < ${dayStart} AND p.odometro_km IS NOT NULL
        ORDER BY p.registrado_em DESC LIMIT 1) AS prev_o,
      (SELECT p.fuel_consumed_l FROM telemetry_events p
        WHERE p.device_id = d.device_id AND p.caminhao_id = ${cid}
          AND p.registrado_em < ${dayStart} AND p.fuel_consumed_l IS NOT NULL
        ORDER BY p.registrado_em DESC LIMIT 1) AS prev_f
    FROM d
  `;
  if (!rows.length) return;

  const num = (v) => (v == null ? null : Number(v));
  const counterDelta = (mx, mn, prev) => {
    if (mx == null) return null;
    const base = prev != null && prev <= mx ? prev : mn;
    return base == null ? null : Math.max(0, mx - base);
  };
  let km = null;
  let fuel = null;
  let vmax = null;
  let engineHours = null;
  let samples = 0;
  for (const r of rows) {
    const dk = counterDelta(num(r.mx_o), num(r.mn_o), num(r.prev_o));
    const df = counterDelta(num(r.mx_f), num(r.mn_f), num(r.prev_f));
    if (dk != null) km = (km ?? 0) + dk;
    if (df != null) fuel = (fuel ?? 0) + df;
    if (r.vmax != null) vmax = Math.max(vmax ?? 0, Number(r.vmax));
    if (r.eh != null) engineHours = Math.max(engineHours ?? 0, Number(r.eh));
    samples += Number(r.n || 0);
  }

  await prisma.$executeRaw`
    INSERT INTO telemetry_daily (
      tenant_id, caminhao_id, dia, km, velocidade_max_kmh, fuel_consumed_l,
      engine_hours, amostras, criado_em, atualizado_em
    ) VALUES (
      ${tid}, ${cid}, ${dayStart}::date, ${km}, ${vmax}, ${fuel},
      ${engineHours}, ${samples}, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, caminhao_id, dia) DO UPDATE SET
      km = EXCLUDED.km,
      velocidade_max_kmh = EXCLUDED.velocidade_max_kmh,
      fuel_consumed_l = EXCLUDED.fuel_consumed_l,
      engine_hours = EXCLUDED.engine_hours,
      amostras = EXCLUDED.amostras,
      atualizado_em = NOW()
  `;
}
