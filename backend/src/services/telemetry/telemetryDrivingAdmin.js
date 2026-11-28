import prisma from "../../lib/prisma.js";

export const DRIVING_EVENT_TYPES = Object.freeze([
  "harsh_acceleration",
  "harsh_braking",
  "harsh_cornering",
  "overspeed",
  "unplug",
  "towing",
  "crash",
  "jamming",
  "fuel_drop", // queda do tanque com o caminhão parado (possível furto)
]);

/** Eventos que dependem de como o motorista dirige (entram em "eventos/100 km"). */
export const BEHAVIOR_TYPES = Object.freeze([
  "harsh_acceleration",
  "harsh_braking",
  "harsh_cornering",
  "overspeed",
]);

const emptyCounts = () => Object.fromEntries(DRIVING_EVENT_TYPES.map((t) => [t, 0]));

/**
 * Relatório de condução do período: por veículo (com km da telemetria),
 * por motorista e últimos eventos.
 */
export async function drivingReport(
  tenantId,
  { from, to, caminhaoId, motoristaId, limit = 200 } = {},
) {
  const tid = Number(tenantId);
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to) : new Date();
  const where = {
    tenant_id: tid,
    ocorrido_em: { gte: fromDate, lte: toDate },
    ...(caminhaoId ? { caminhao_id: Number(caminhaoId) } : {}),
    ...(motoristaId ? { motorista_id: Number(motoristaId) } : {}),
  };

  const [grouped, latest, daily] = await Promise.all([
    prisma.telemetry_driving_events.groupBy({
      by: ["caminhao_id", "motorista_id", "tipo"],
      where,
      _count: { _all: true },
    }),
    prisma.telemetry_driving_events.findMany({
      where,
      orderBy: { ocorrido_em: "desc" },
      take: Math.min(Math.max(Number(limit) || 200, 1), 1000),
      include: {
        caminhoes: { select: { placa: true } },
        motoristas: { select: { nome: true } },
      },
    }),
    prisma.telemetry_daily.findMany({
      where: {
        tenant_id: tid,
        dia: { gte: new Date(fromDate.toISOString().slice(0, 10)), lte: toDate },
        ...(caminhaoId ? { caminhao_id: Number(caminhaoId) } : {}),
      },
      select: { caminhao_id: true, km: true },
    }),
  ]);

  const kmByTruck = new Map();
  for (const d of daily) {
    kmByTruck.set(d.caminhao_id, (kmByTruck.get(d.caminhao_id) || 0) + Number(d.km || 0));
  }

  const truckIds = new Set([...kmByTruck.keys()]);
  const driverIds = new Set();
  for (const g of grouped) {
    if (g.caminhao_id) truckIds.add(g.caminhao_id);
    if (g.motorista_id) driverIds.add(g.motorista_id);
  }

  const [trucks, drivers] = await Promise.all([
    truckIds.size
      ? prisma.caminhoes.findMany({
          where: { tenant_id: tid, id: { in: [...truckIds] } },
          select: { id: true, placa: true },
        })
      : [],
    driverIds.size
      ? prisma.motoristas.findMany({
          where: { tenant_id: tid, id: { in: [...driverIds] } },
          select: { id: true, nome: true },
        })
      : [],
  ]);
  const placaById = new Map(trucks.map((t) => [t.id, t.placa]));
  const nomeById = new Map(drivers.map((d) => [d.id, d.nome]));

  const byTruck = new Map();
  const byDriver = new Map();
  const totals = emptyCounts();
  for (const g of grouped) {
    const n = g._count._all;
    if (totals[g.tipo] != null) totals[g.tipo] += n;
    if (g.caminhao_id) {
      const cur = byTruck.get(g.caminhao_id) || emptyCounts();
      cur[g.tipo] = (cur[g.tipo] || 0) + n;
      byTruck.set(g.caminhao_id, cur);
    }
    if (g.motorista_id) {
      const cur = byDriver.get(g.motorista_id) || emptyCounts();
      cur[g.tipo] = (cur[g.tipo] || 0) + n;
      byDriver.set(g.motorista_id, cur);
    }
  }

  const behaviorSum = (counts) => BEHAVIOR_TYPES.reduce((a, t) => a + (counts[t] || 0), 0);

  const vehicles = [...truckIds].map((id) => {
    const counts = byTruck.get(id) || emptyCounts();
    const km = Math.round((kmByTruck.get(id) || 0) * 10) / 10;
    const behavior = behaviorSum(counts);
    return {
      caminhao_id: id,
      placa: placaById.get(id) ?? null,
      km,
      counts,
      behavior_events: behavior,
      // Eventos de condução a cada 100 km: só quando há km suficiente.
      per_100km: km >= 10 ? Math.round((behavior / km) * 1000) / 10 : null,
    };
  });

  const driversOut = [...driverIds].map((id) => {
    const counts = byDriver.get(id) || emptyCounts();
    return {
      motorista_id: id,
      nome: nomeById.get(id) ?? null,
      counts,
      behavior_events: behaviorSum(counts),
    };
  });

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    totals,
    behavior_total: behaviorSum(totals),
    vehicles: vehicles.sort((a, b) => b.behavior_events - a.behavior_events),
    drivers: driversOut.sort((a, b) => b.behavior_events - a.behavior_events),
    events: latest.map((e) => ({
      id: String(e.id),
      tipo: e.tipo,
      valor: e.valor != null ? Number(e.valor) : null,
      velocidade_kmh: e.velocidade_kmh != null ? Number(e.velocidade_kmh) : null,
      latitude: e.latitude != null ? Number(e.latitude) : null,
      longitude: e.longitude != null ? Number(e.longitude) : null,
      ocorrido_em: e.ocorrido_em,
      caminhao_id: e.caminhao_id,
      placa: e.caminhoes?.placa ?? null,
      motorista_id: e.motorista_id,
      motorista: e.motoristas?.nome ?? null,
    })),
  };
}
