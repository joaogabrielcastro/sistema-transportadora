import prisma from "../../lib/prisma.js";

/**
 * Detecção de queda de combustível (possível furto/desvio) a partir do nível
 * do tanque lido do caminhão (FMS, IO 87 no FMC650).
 *
 * Regra conservadora, para não acusar à toa:
 *  - compara o ponto com a leitura anterior do mesmo aparelho (até 12 h antes);
 *  - os dois pontos com o veículo PARADO (velocidade ≤ 3 km/h): em movimento o
 *    combustível balança no tanque e o nível oscila;
 *  - queda de pelo menos FUEL_DROP_MIN_PCT pontos percentuais;
 *  - se o contador de combustível do motor existir, o motor não pode ter
 *    queimado mais que FUEL_DROP_MAX_ENGINE_L no intervalo (marcha lenta
 *    longa não é furto).
 */
export const FUEL_DROP_MIN_PCT = 8;
export const FUEL_DROP_MAX_ENGINE_L = 10;
const FUEL_DROP_WINDOW_MS = 12 * 3600_000;
const STOPPED_KMH = 3;

/**
 * @param {{ level: number|null, speedKmh: number|null, engineL: number|null, at: Date }} prev
 * @param {{ level: number|null, speedKmh: number|null, engineL: number|null, at: Date }} cur
 * @returns {{ dropPct: number, engineL: number|null } | null}
 */
export function evaluateFuelDrop(prev, cur) {
  if (!prev || !cur) return null;
  if (prev.level == null || cur.level == null) return null;
  const gap = new Date(cur.at).getTime() - new Date(prev.at).getTime();
  if (!(gap > 0) || gap > FUEL_DROP_WINDOW_MS) return null;
  const stopped = (v) => v == null || Number(v) <= STOPPED_KMH;
  if (!stopped(prev.speedKmh) || !stopped(cur.speedKmh)) return null;
  const dropPct = Number(prev.level) - Number(cur.level);
  if (dropPct < FUEL_DROP_MIN_PCT) return null;
  let engineL = null;
  if (prev.engineL != null && cur.engineL != null && Number(cur.engineL) >= Number(prev.engineL)) {
    engineL = Number(cur.engineL) - Number(prev.engineL);
    if (engineL > FUEL_DROP_MAX_ENGINE_L) return null;
  }
  return { dropPct: Math.round(dropPct * 10) / 10, engineL };
}

/**
 * Avalia o ponto recém-gravado e registra o evento "fuel_drop" (idempotente
 * pela event_key). Não lança erro: a ingestão não depende disso.
 */
export async function checkFuelDrop({
  device,
  caminhaoId,
  motoristaId,
  eventKey,
  recordedAt,
  fuelLevelPct,
  fuelConsumedL,
  speedKmh,
  latitude,
  longitude,
}) {
  if (fuelLevelPct == null) return null;
  try {
    const recorded = new Date(recordedAt);
    const prev = await prisma.telemetry_events.findFirst({
      where: {
        device_id: device.id,
        fuel_level_pct: { not: null },
        registrado_em: { lt: recorded, gte: new Date(recorded.getTime() - FUEL_DROP_WINDOW_MS) },
      },
      orderBy: { registrado_em: "desc" },
      select: { fuel_level_pct: true, velocidade_kmh: true, fuel_consumed_l: true, registrado_em: true },
    });
    if (!prev) return null;
    const num = (v) => (v == null ? null : Number(v));
    const drop = evaluateFuelDrop(
      {
        level: num(prev.fuel_level_pct),
        speedKmh: num(prev.velocidade_kmh),
        engineL: num(prev.fuel_consumed_l),
        at: prev.registrado_em,
      },
      { level: num(fuelLevelPct), speedKmh: num(speedKmh), engineL: num(fuelConsumedL), at: recorded },
    );
    if (!drop) return null;
    await prisma.$executeRaw`
      INSERT INTO telemetry_driving_events (
        tenant_id, device_id, caminhao_id, motorista_id, event_key, tipo,
        valor, velocidade_kmh, latitude, longitude, ocorrido_em
      ) VALUES (
        ${device.tenant_id}, ${device.id}, ${caminhaoId}, ${motoristaId ?? null},
        ${`${eventKey}:fuel_drop`.slice(0, 100)}, ${"fuel_drop"},
        ${drop.dropPct}, ${speedKmh ?? null}, ${latitude ?? null}, ${longitude ?? null}, ${recorded}
      )
      ON CONFLICT (device_id, event_key) DO NOTHING
    `;
    return drop;
  } catch {
    return null;
  }
}
