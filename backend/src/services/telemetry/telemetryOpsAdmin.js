import prisma from "../../lib/prisma.js";
import { isInsideGeofence } from "./geofenceMath.js";
import {
  telemetryLimitsForPlan,
  assertSeatAvailable,
} from "./telemetryPolicy.js";

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export async function listGeofences(tenantId) {
  const rows = await prisma.telemetry_geofences.findMany({
    where: { tenant_id: Number(tenantId) },
    include: {
      vehicle_links: {
        include: { caminhoes: { select: { id: true, placa: true } } },
      },
    },
    orderBy: { id: "desc" },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    shape: g.shape,
    geometry: g.geometry,
    enabled: g.enabled,
    vehicles: g.vehicle_links.map((v) => ({
      caminhao_id: v.caminhao_id,
      placa: v.caminhoes?.placa ?? null,
    })),
    criado_em: g.criado_em,
  }));
}

export async function createGeofence(tenantId, body) {
  const shape = String(body.shape || "").toLowerCase();
  if (shape !== "circle" && shape !== "polygon") {
    throw httpError("shape deve ser circle ou polygon.", 400, "GEOFENCE_SHAPE");
  }
  if (shape === "circle") {
    const c = body.geometry?.center;
    if (
      !c ||
      !Number.isFinite(Number(c.lat)) ||
      !Number.isFinite(Number(c.lng)) ||
      !Number.isFinite(Number(body.geometry?.radius_m))
    ) {
      throw httpError("Geometria circular inválida.", 400, "GEOFENCE_GEOMETRY");
    }
  }
  if (shape === "polygon") {
    const pts = body.geometry?.points;
    if (!Array.isArray(pts) || pts.length < 3) {
      throw httpError("Polígono precisa de ao menos 3 pontos.", 400, "GEOFENCE_GEOMETRY");
    }
  }

  const fence = await prisma.telemetry_geofences.create({
    data: {
      tenant_id: Number(tenantId),
      name: String(body.name).slice(0, 120),
      shape,
      geometry: body.geometry,
      enabled: body.enabled !== false,
    },
  });

  if (Array.isArray(body.caminhao_ids) && body.caminhao_ids.length) {
    for (const id of body.caminhao_ids) {
      const truck = await prisma.caminhoes.findFirst({
        where: { id: Number(id), tenant_id: Number(tenantId) },
        select: { id: true },
      });
      if (!truck) continue;
      await prisma.telemetry_geofence_vehicles.create({
        data: {
          tenant_id: Number(tenantId),
          geofence_id: fence.id,
          caminhao_id: truck.id,
        },
      });
    }
  }

  return (await listGeofences(tenantId)).find((g) => g.id === fence.id);
}

export async function updateGeofence(tenantId, id, body) {
  const existing = await prisma.telemetry_geofences.findFirst({
    where: { id: Number(id), tenant_id: Number(tenantId) },
  });
  if (!existing) throw httpError("Geocerca não encontrada.", 404, "GEOFENCE_NOT_FOUND");

  const data = {};
  if (body.name != null) data.name = String(body.name).slice(0, 120);
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.geometry != null) data.geometry = body.geometry;
  if (body.shape != null) data.shape = String(body.shape).toLowerCase();

  await prisma.telemetry_geofences.update({ where: { id: existing.id }, data });

  if (Array.isArray(body.caminhao_ids)) {
    await prisma.telemetry_geofence_vehicles.deleteMany({
      where: { geofence_id: existing.id, tenant_id: Number(tenantId) },
    });
    for (const cid of body.caminhao_ids) {
      const truck = await prisma.caminhoes.findFirst({
        where: { id: Number(cid), tenant_id: Number(tenantId) },
        select: { id: true },
      });
      if (!truck) continue;
      await prisma.telemetry_geofence_vehicles.create({
        data: {
          tenant_id: Number(tenantId),
          geofence_id: existing.id,
          caminhao_id: truck.id,
        },
      });
    }
  }

  return (await listGeofences(tenantId)).find((g) => g.id === existing.id);
}

export async function deleteGeofence(tenantId, id) {
  const result = await prisma.telemetry_geofences.deleteMany({
    where: { id: Number(id), tenant_id: Number(tenantId) },
  });
  if (result.count !== 1) {
    throw httpError("Geocerca não encontrada.", 404, "GEOFENCE_NOT_FOUND");
  }
  return { deleted: true };
}

export async function listAlerts(tenantId, { status, limit = 100 } = {}) {
  const where = { tenant_id: Number(tenantId) };
  if (status) where.status = status;
  const rows = await prisma.telemetry_alerts.findMany({
    where,
    orderBy: { occurred_at: "desc" },
    take: Math.min(Number(limit) || 100, 500),
    include: {
      caminhoes: { select: { id: true, placa: true } },
      geofences: { select: { id: true, name: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    alert_type: a.alert_type,
    severity: a.severity,
    description: a.description,
    status: a.status,
    occurred_at: a.occurred_at,
    resolved_at: a.resolved_at,
    caminhao_id: a.caminhao_id,
    placa: a.caminhoes?.placa ?? null,
    geofence_id: a.geofence_id,
    geofence_name: a.geofences?.name ?? null,
    payload: a.payload,
  }));
}

export async function resolveAlert(tenantId, id) {
  const result = await prisma.telemetry_alerts.updateMany({
    where: {
      id: Number(id),
      tenant_id: Number(tenantId),
      status: "open",
    },
    data: { status: "resolved", resolved_at: new Date() },
  });
  if (result.count !== 1) {
    throw httpError("Alerta não encontrado ou já resolvido.", 404, "ALERT_NOT_FOUND");
  }
  return { resolved: true };
}

export async function listAlertRules(tenantId) {
  return prisma.telemetry_alert_rules.findMany({
    where: { tenant_id: Number(tenantId) },
    orderBy: [{ alert_type: "asc" }, { id: "asc" }],
  });
}

export async function upsertAlertRule(tenantId, body) {
  const alertType = String(body.alert_type || "").trim();
  if (!alertType) throw httpError("alert_type obrigatório.", 400, "ALERT_TYPE");

  if (body.id) {
    const result = await prisma.telemetry_alert_rules.updateMany({
      where: { id: Number(body.id), tenant_id: Number(tenantId) },
      data: {
        enabled: body.enabled !== false,
        config: body.config ?? {},
        caminhao_id: body.caminhao_id ?? null,
      },
    });
    if (result.count !== 1) {
      throw httpError("Regra não encontrada.", 404, "RULE_NOT_FOUND");
    }
    return prisma.telemetry_alert_rules.findFirst({
      where: { id: Number(body.id), tenant_id: Number(tenantId) },
    });
  }

  return prisma.telemetry_alert_rules.create({
    data: {
      tenant_id: Number(tenantId),
      alert_type: alertType.slice(0, 32),
      enabled: body.enabled !== false,
      config: body.config ?? {},
      caminhao_id: body.caminhao_id ?? null,
    },
  });
}

export async function getSubscription(tenantId) {
  const sub = await prisma.telemetry_subscriptions.findFirst({
    where: { tenant_id: Number(tenantId), status: "active" },
    orderBy: { id: "desc" },
  });
  const activeDevices = await prisma.telemetry_devices.count({
    where: { tenant_id: Number(tenantId), ativo: true, revogado_em: null },
  });
  const assigned = await prisma.telemetry_device_assignments.count({
    where: { tenant_id: Number(tenantId), fim_em: null },
  });
  return {
    subscription: sub,
    usage: {
      active_devices: activeDevices,
      assigned_vehicles: assigned,
      seat_limit: sub?.seat_limit ?? null,
    },
    limits: telemetryLimitsForPlan(sub?.plan),
  };
}

export async function upsertSubscription(tenantId, body) {
  const plan = String(body.plan || "basic").slice(0, 32);
  const seatLimit = Number(body.seat_limit ?? 0);
  const existing = await prisma.telemetry_subscriptions.findFirst({
    where: { tenant_id: Number(tenantId), status: "active" },
  });
  if (existing) {
    return prisma.telemetry_subscriptions.update({
      where: { id: existing.id },
      data: {
        plan,
        seat_limit: seatLimit,
        monthly_price: body.monthly_price ?? existing.monthly_price,
        stripe_price_id: body.stripe_price_id ?? existing.stripe_price_id,
      },
    });
  }
  return prisma.telemetry_subscriptions.create({
    data: {
      tenant_id: Number(tenantId),
      plan,
      seat_limit: seatLimit,
      monthly_price: body.monthly_price ?? null,
      stripe_price_id: body.stripe_price_id ?? null,
      status: "active",
    },
  });
}

/** Relatório eficiência: telemetria vs gastos de combustível (somente leitura). */
export async function efficiencyReport(tenantId, { from, to } = {}) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to) : new Date();

  const daily = await prisma.telemetry_daily.findMany({
    where: {
      tenant_id: Number(tenantId),
      dia: { gte: fromDate, lte: toDate },
    },
    include: { caminhoes: { select: { id: true, placa: true } } },
  });

  const byTruck = new Map();
  for (const row of daily) {
    const key = row.caminhao_id;
    const cur = byTruck.get(key) || {
      caminhao_id: key,
      placa: row.caminhoes?.placa ?? null,
      km: 0,
      fuel_consumed_l: 0,
      amostras: 0,
      has_fuel_telemetry: false,
    };
    cur.km += Number(row.km || 0);
    if (row.fuel_consumed_l != null) {
      cur.fuel_consumed_l += Number(row.fuel_consumed_l);
      cur.has_fuel_telemetry = true;
    }
    cur.amostras += row.amostras;
    byTruck.set(key, cur);
  }

  const gastos = await prisma.gastos.findMany({
    where: {
      tenant_id: Number(tenantId),
      data_gasto: { gte: fromDate, lte: toDate },
      OR: [
        { quantidade_combustivel: { not: null } },
        {
          tipos_gastos: {
            nome_tipo: { contains: "combust", mode: "insensitive" },
          },
        },
        {
          tipos_gastos: {
            nome_tipo: { contains: "diesel", mode: "insensitive" },
          },
        },
        {
          tipos_gastos: {
            nome_tipo: { contains: "abastec", mode: "insensitive" },
          },
        },
      ],
    },
    select: {
      caminhao_id: true,
      valor: true,
      quantidade_combustivel: true,
    },
  });

  const fuelByTruck = new Map();
  for (const g of gastos) {
    if (!g.caminhao_id) continue;
    const cur = fuelByTruck.get(g.caminhao_id) || { litros: 0, valor: 0 };
    cur.litros += Number(g.quantidade_combustivel || 0);
    cur.valor += Number(g.valor || 0);
    fuelByTruck.set(g.caminhao_id, cur);
  }

  const vehicles = [...byTruck.values()].map((v) => {
    const manual = fuelByTruck.get(v.caminhao_id) || { litros: 0, valor: 0 };
    const telemFuel = v.has_fuel_telemetry ? v.fuel_consumed_l : null;
    const litersForEfficiency =
      telemFuel != null && telemFuel > 0.05
        ? telemFuel
        : manual.litros > 0.05
          ? manual.litros
          : null;
    const kmPerL =
      v.km > 0 && litersForEfficiency != null
        ? v.km / litersForEfficiency
        : null;
    return {
      ...v,
      fuel_telemetry_l: telemFuel,
      fuel_manual_l: manual.litros || null,
      fuel_manual_cost: manual.valor || null,
      km_per_l: kmPerL,
      efficiency_source:
        telemFuel != null && telemFuel > 0.05
          ? "telemetry"
          : manual.litros > 0.05
            ? "manual"
            : null,
      cost_per_km:
        v.km > 0 && manual.valor > 0 ? manual.valor / v.km : null,
      divergence_l:
        telemFuel != null && manual.litros > 0
          ? telemFuel - manual.litros
          : null,
    };
  });

  const withEff = vehicles.filter(
    (v) => v.km_per_l != null && Number.isFinite(v.km_per_l),
  );
  const fleetKmPerL =
    withEff.length > 0
      ? withEff.reduce((s, v) => s + Number(v.km_per_l), 0) / withEff.length
      : null;

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    vehicles,
    fleet_km_per_l: fleetKmPerL,
    note:
      "km/L usa combustível da telemetria quando existir; senão, litros dos gastos manuais. Gastos manuais não são alterados automaticamente.",
  };
}

export async function pointAgainstGeofences(tenantId, caminhaoId, lat, lng) {
  const fences = await prisma.telemetry_geofences.findMany({
    where: {
      tenant_id: Number(tenantId),
      enabled: true,
      OR: [
        { vehicle_links: { none: {} } },
        { vehicle_links: { some: { caminhao_id: Number(caminhaoId) } } },
      ],
    },
  });
  const point = { lat: Number(lat), lng: Number(lng) };
  return fences.map((f) => ({
    id: f.id,
    name: f.name,
    inside: isInsideGeofence(point, f),
  }));
}

export { assertSeatAvailable };
