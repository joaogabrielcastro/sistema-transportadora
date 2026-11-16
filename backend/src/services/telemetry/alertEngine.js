import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { isInsideGeofence } from "./geofenceMath.js";
import { TELEMETRY_OFFLINE_AFTER_MS } from "./telemetryDeviceAdmin.js";

const DEFAULT_RULES = [
  { alert_type: "speed", config: { max_speed_kmh: 90 } },
  { alert_type: "offline", config: { offline_after_min: 15 } },
  { alert_type: "geofence_enter", config: {} },
  { alert_type: "geofence_exit", config: {} },
  { alert_type: "engine_temp", config: { max_engine_temp_c: 105 } },
];

/** Debounce in-process (evita rajada com concurrency > 1 na mesma fila). */
const recentAlertKeys = new Map();

function claimAlertSlot(key, ttlMs = 60_000) {
  const now = Date.now();
  for (const [k, until] of recentAlertKeys) {
    if (until <= now) recentAlertKeys.delete(k);
  }
  const until = recentAlertKeys.get(key);
  if (until && until > now) return false;
  recentAlertKeys.set(key, now + ttlMs);
  return true;
}

function mergeConfig(rule) {
  const base =
    DEFAULT_RULES.find((r) => r.alert_type === rule.alert_type)?.config || {};
  const cfg =
    rule.config && typeof rule.config === "object" && !Array.isArray(rule.config)
      ? rule.config
      : {};
  return { ...base, ...cfg };
}

async function openAlertExists(tenantId, alertType, caminhaoId, sinceMs = 10 * 60_000) {
  const since = new Date(Date.now() - sinceMs);
  const where = {
    tenant_id: Number(tenantId),
    alert_type: alertType,
    status: "open",
    occurred_at: { gte: since },
  };
  if (caminhaoId != null) where.caminhao_id = Number(caminhaoId);
  const row = await prisma.telemetry_alerts.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(row);
}

async function createAlert({
  tenantId,
  caminhaoId = null,
  deviceId = null,
  geofenceId = null,
  alertType,
  severity = "warning",
  description,
  payload = null,
  occurredAt = new Date(),
}) {
  return prisma.telemetry_alerts.create({
    data: {
      tenant_id: Number(tenantId),
      caminhao_id: caminhaoId != null ? Number(caminhaoId) : null,
      device_id: deviceId != null ? Number(deviceId) : null,
      geofence_id: geofenceId != null ? Number(geofenceId) : null,
      alert_type: alertType,
      severity,
      description: String(description).slice(0, 500),
      status: "open",
      payload: payload ?? undefined,
      occurred_at: new Date(occurredAt),
    },
  });
}

/**
 * Avalia regras após um ponto ingerido (só se inserted).
 */
export async function evaluateTelemetryAlerts({
  tenantId,
  deviceId,
  caminhaoId,
  latitude,
  longitude,
  speedKmh,
  ignition,
  engineTempC,
  previousState = null,
  occurredAt = new Date(),
}) {
  const rules = await prisma.telemetry_alert_rules.findMany({
    where: {
      tenant_id: Number(tenantId),
      enabled: true,
      OR: [{ caminhao_id: null }, { caminhao_id: Number(caminhaoId) }],
    },
  });

  const effective =
    rules.length > 0
      ? rules
      : DEFAULT_RULES.map((r) => ({
          alert_type: r.alert_type,
          config: r.config,
          enabled: true,
        }));

  const created = [];

  // Voltou a transmitir: fecha offline aberto deste veículo.
  if (caminhaoId != null) {
    await prisma.telemetry_alerts.updateMany({
      where: {
        tenant_id: Number(tenantId),
        caminhao_id: Number(caminhaoId),
        alert_type: "offline",
        status: "open",
      },
      data: { status: "resolved", resolved_at: new Date() },
    });
  }

  for (const rule of effective) {
    const type = rule.alert_type;
    const cfg = mergeConfig(rule);

    try {
      if (type === "speed" && speedKmh != null) {
        const max = Number(cfg.max_speed_kmh ?? 90);
        if (Number(speedKmh) > max) {
          const slot = `speed:${tenantId}:${caminhaoId}`;
          if (
            claimAlertSlot(slot, 10 * 60_000) &&
            !(await openAlertExists(tenantId, "speed", caminhaoId))
          ) {
            created.push(
              await createAlert({
                tenantId,
                caminhaoId,
                deviceId,
                alertType: "speed",
                severity: "warning",
                description: `Excesso de velocidade: ${Number(speedKmh).toFixed(0)} km/h (limite ${max}).`,
                payload: { speed_kmh: speedKmh, max_speed_kmh: max },
                occurredAt,
              }),
            );
          }
        }
      }

      if (type === "engine_temp" && engineTempC != null) {
        const max = Number(cfg.max_engine_temp_c ?? 105);
        if (Number(engineTempC) > max) {
          if (!(await openAlertExists(tenantId, "engine_temp", caminhaoId))) {
            created.push(
              await createAlert({
                tenantId,
                caminhaoId,
                deviceId,
                alertType: "engine_temp",
                severity: "critical",
                description: `Temperatura do motor elevada: ${Number(engineTempC).toFixed(0)} °C.`,
                payload: { engine_temp_c: engineTempC, max_engine_temp_c: max },
                occurredAt,
              }),
            );
          }
        }
      }

      if (
        (type === "ignition_on" || type === "ignition_off") &&
        typeof ignition === "boolean" &&
        previousState &&
        typeof previousState.ignicao === "boolean" &&
        previousState.ignicao !== ignition
      ) {
        const wantOn = type === "ignition_on";
        if (ignition === wantOn) {
          created.push(
            await createAlert({
              tenantId,
              caminhaoId,
              deviceId,
              alertType: type,
              severity: "info",
              description: ignition ? "Ignição ligada." : "Ignição desligada.",
              payload: { ignition },
              occurredAt,
            }),
          );
        }
      }

      if (
        (type === "geofence_enter" || type === "geofence_exit") &&
        latitude != null &&
        longitude != null
      ) {
        const fences = await prisma.telemetry_geofences.findMany({
          where: {
            tenant_id: Number(tenantId),
            enabled: true,
            OR: [
              { vehicle_links: { none: {} } },
              { vehicle_links: { some: { caminhao_id: Number(caminhaoId) } } },
            ],
          },
          include: { vehicle_links: true },
        });

        const point = { lat: Number(latitude), lng: Number(longitude) };
        const prevPoint =
          previousState?.latitude != null && previousState?.longitude != null
            ? {
                lat: Number(previousState.latitude),
                lng: Number(previousState.longitude),
              }
            : null;

        for (const fence of fences) {
          const nowInside = isInsideGeofence(point, fence);
          const wasInside = prevPoint
            ? isInsideGeofence(prevPoint, fence)
            : null;
          if (wasInside == null) continue;

          if (type === "geofence_enter" && !wasInside && nowInside) {
            const slot = `geofence_enter:${tenantId}:${caminhaoId}:${fence.id}`;
            if (
              claimAlertSlot(slot, 5 * 60_000) &&
              !(await openAlertExists(
                tenantId,
                "geofence_enter",
                caminhaoId,
                5 * 60_000,
              ))
            ) {
              created.push(
                await createAlert({
                  tenantId,
                  caminhaoId,
                  deviceId,
                  geofenceId: fence.id,
                  alertType: "geofence_enter",
                  severity: "info",
                  description: `Entrada na geocerca "${fence.name}".`,
                  payload: { geofence_id: fence.id, name: fence.name },
                  occurredAt,
                }),
              );
            }
          }
          if (type === "geofence_exit" && wasInside && !nowInside) {
            const slot = `geofence_exit:${tenantId}:${caminhaoId}:${fence.id}`;
            if (
              claimAlertSlot(slot, 5 * 60_000) &&
              !(await openAlertExists(
                tenantId,
                "geofence_exit",
                caminhaoId,
                5 * 60_000,
              ))
            ) {
              created.push(
                await createAlert({
                  tenantId,
                  caminhaoId,
                  deviceId,
                  geofenceId: fence.id,
                  alertType: "geofence_exit",
                  severity: "warning",
                  description: `Saída da geocerca "${fence.name}".`,
                  payload: { geofence_id: fence.id, name: fence.name },
                  occurredAt,
                }),
              );
            }
          }
        }
      }
    } catch (err) {
      logger.warn("telemetry alert evaluation failed", {
        alertType: type,
        err: err?.message,
      });
    }
  }

  return created;
}

/**
 * Varre devices offline e gera alertas (job periódico).
 */
export async function scanOfflineDevices({ now = new Date() } = {}) {
  const threshold = new Date(
    now.getTime() - (TELEMETRY_OFFLINE_AFTER_MS || 15 * 60_000),
  );
  const devices = await prisma.telemetry_devices.findMany({
    where: {
      ativo: true,
      revogado_em: null,
      OR: [{ last_seen_at: null }, { last_seen_at: { lt: threshold } }],
    },
    select: { id: true, tenant_id: true, last_seen_at: true, nome: true },
  });

  let created = 0;
  for (const device of devices) {
    const openAsg = await prisma.telemetry_device_assignments.findFirst({
      where: { device_id: device.id, fim_em: null },
      select: { caminhao_id: true },
    });
    if (!openAsg) continue;
    if (
      await openAlertExists(device.tenant_id, "offline", openAsg.caminhao_id, 60 * 60_000)
    ) {
      continue;
    }
    await createAlert({
      tenantId: device.tenant_id,
      caminhaoId: openAsg.caminhao_id,
      deviceId: device.id,
      alertType: "offline",
      severity: "warning",
      description: `Dispositivo sem comunicação (${device.nome || device.id}).`,
      payload: { last_seen_at: device.last_seen_at },
      occurredAt: now,
    });
    created += 1;
  }
  return { scanned: devices.length, created };
}
