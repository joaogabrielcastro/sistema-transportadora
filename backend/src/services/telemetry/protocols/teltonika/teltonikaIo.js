/**
 * Interpretação dos IOs (AVL IDs) dos rastreadores Teltonika da linha FMB
 * (FMB920, FMB130 e similares). Referência: Teltonika Wiki — "FMB920/FMB130
 * Teltonika Data Sending Parameters ID". Os valores brutos de TODOS os IOs são
 * guardados em telemetry_events.io; aqui só traduzimos os que o ATrack usa.
 *
 * Validar com o aparelho real antes da produção: alguns IDs dependem da
 * configuração (Teltonika Configurator) e da versão de firmware.
 */

/** Permanentes (vêm em todo registro, conforme configuração). */
export const IO = Object.freeze({
  DIN1: 1,
  FUEL_USED_GPS_ML: 12,
  ODOMETER_TOTAL_M: 16,
  GSM_SIGNAL: 21, // 0–5
  EXTERNAL_VOLTAGE_MV: 66, // tensão da bateria do veículo
  INTERNAL_BATTERY_MV: 67, // bateria interna do rastreador
  GNSS_STATUS: 69,
  IBUTTON: 78, // 8 bytes (FMB130 com leitor 1-Wire)
  FUEL_LEVEL_PCT: 89, // só com leitura CAN (não vem no FMB920/FMB130 puro)
  IGNITION: 239,
  MOVEMENT: 240,
  // Eventuais (vêm no registro gerado pelo evento)
  TOWING: 246,
  CRASH: 247,
  JAMMING: 249,
  IDLING: 251,
  UNPLUG: 252,
  GREEN_DRIVING_TYPE: 253, // 1 aceleração, 2 frenagem, 3 curva
  GREEN_DRIVING_VALUE: 254, // g*100 (curva por GPS: rad/s*100)
  OVERSPEEDING: 255, // velocidade (km/h) no momento do excesso
});

export const DRIVING_EVENT_LABEL = Object.freeze({
  harsh_acceleration: "Aceleração brusca",
  harsh_braking: "Frenagem brusca",
  harsh_cornering: "Curva brusca",
  overspeed: "Excesso de velocidade",
  unplug: "Rastreador desconectado da alimentação",
  towing: "Veículo rebocado / movido desligado",
  crash: "Possível colisão",
  jamming: "Bloqueio de sinal (jammer)",
});

const GREEN_TYPES = { 1: "harsh_acceleration", 2: "harsh_braking", 3: "harsh_cornering" };

const toNumber = (v) => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Valor de 8 bytes (iButton) chega como hexadecimal; zeros = sem iButton. */
export function normalizeIbutton(raw) {
  if (raw == null) return null;
  const hex = String(raw).trim().toUpperCase().replace(/^0X/, "");
  if (!/^[0-9A-F]+$/.test(hex) || /^0+$/.test(hex)) return null;
  return hex.padStart(16, "0");
}

/**
 * Traduz o mapa de IOs de um registro em campos do ATrack.
 * @param {Map<number, number|string>|Record<string, number|string>} ioInput
 */
export function interpretTeltonikaIo(ioInput) {
  const get = (id) =>
    ioInput instanceof Map ? ioInput.get(id) : ioInput?.[String(id)] ?? ioInput?.[id];

  const ignitionRaw = toNumber(get(IO.IGNITION));
  const odometerM = toNumber(get(IO.ODOMETER_TOTAL_M));
  const fuelUsedMl = toNumber(get(IO.FUEL_USED_GPS_ML));
  const fuelLevel = toNumber(get(IO.FUEL_LEVEL_PCT));
  const extMv = toNumber(get(IO.EXTERNAL_VOLTAGE_MV));
  const gsm = toNumber(get(IO.GSM_SIGNAL));

  return {
    ignition: ignitionRaw == null ? null : ignitionRaw !== 0,
    odometerKm: odometerM == null ? null : odometerM / 1000,
    fuelConsumedL: fuelUsedMl == null ? null : fuelUsedMl / 1000,
    fuelLevelPct: fuelLevel == null ? null : Math.max(0, Math.min(100, fuelLevel)),
    // Tensão externa = bateria do veículo (12 V / 24 V). Guardada em battery_v.
    batteryV: extMv == null ? null : Math.round(extMv / 10) / 100,
    gsmSignal: gsm == null ? null : Math.max(0, Math.min(5, Math.round(gsm))),
    ibutton: normalizeIbutton(get(IO.IBUTTON)),
  };
}

/**
 * Eventos de condução/segurança de um registro. Usa o "event IO ID" do
 * registro quando presente (registro gerado pelo evento) e, por segurança,
 * também reconhece os IOs eventuais presentes no mapa.
 * @param {{ eventIoId?: number|null, io: Map<number, number|string>|Record<string, number|string>, speedKmh?: number|null }} rec
 * @returns {Array<{ tipo: string, valor: number|null, ioId: number }>}
 */
export function teltonikaDrivingEvents(rec) {
  const io = rec?.io;
  const get = (id) =>
    io instanceof Map ? io.get(id) : io?.[String(id)] ?? io?.[id];
  const has = (id) => get(id) != null;
  const events = [];

  const greenType = toNumber(get(IO.GREEN_DRIVING_TYPE));
  if (greenType != null && GREEN_TYPES[greenType]) {
    const raw = toNumber(get(IO.GREEN_DRIVING_VALUE));
    events.push({
      tipo: GREEN_TYPES[greenType],
      valor: raw == null ? null : raw / 100,
      ioId: IO.GREEN_DRIVING_TYPE,
    });
  }

  // Excesso de velocidade: registro do início do evento traz a velocidade (>0).
  if (has(IO.OVERSPEEDING)) {
    const v = toNumber(get(IO.OVERSPEEDING));
    if (v != null && v > 0) {
      events.push({ tipo: "overspeed", valor: v, ioId: IO.OVERSPEEDING });
    }
  }

  // Desconexão da alimentação: 1 = desconectado.
  if (toNumber(get(IO.UNPLUG)) === 1) {
    events.push({ tipo: "unplug", valor: null, ioId: IO.UNPLUG });
  }
  // Reboque: 1 = veículo em movimento com ignição desligada.
  if (toNumber(get(IO.TOWING)) === 1) {
    events.push({ tipo: "towing", valor: null, ioId: IO.TOWING });
  }
  // Colisão: valor > 0 indica detecção.
  const crash = toNumber(get(IO.CRASH));
  if (crash != null && crash > 0) {
    events.push({ tipo: "crash", valor: crash, ioId: IO.CRASH });
  }
  // Jamming: 1 = início do bloqueio de sinal GSM.
  if (toNumber(get(IO.JAMMING)) === 1) {
    events.push({ tipo: "jamming", valor: null, ioId: IO.JAMMING });
  }

  return events;
}

/** Converte o Map de IOs em objeto JSON (chaves = AVL IDs). */
export function ioMapToJson(map) {
  if (!(map instanceof Map) || map.size === 0) return null;
  const out = {};
  for (const [id, value] of map.entries()) out[String(id)] = value;
  return out;
}
