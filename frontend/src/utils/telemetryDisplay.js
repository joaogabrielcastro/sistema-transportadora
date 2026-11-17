/**
 * Regras de EXIBIÇÃO da telemetria (sem regra de negócio): um único status
 * por veículo, tempo relativo, viagens/paradas derivadas dos pontos e
 * sinalização de consumo fora da faixa plausível para caminhões.
 */

/** Acima disso o veículo é considerado em movimento (mesmo limiar já usado na tela). */
export const MOVING_SPEED_KMH = 3;

/**
 * Faixa plausível de km/L para veículos pesados. Fora dela o número quase
 * sempre indica sensor/contador incorreto — exibimos com aviso, não como fato.
 */
export const PLAUSIBLE_KM_PER_L = { min: 0.8, max: 8 };

export const VEHICLE_STATUS = {
  moving: { label: "Em movimento", dot: "bg-emerald-500", tone: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  idle: { label: "Parado ligado", dot: "bg-amber-500", tone: "text-amber-700", chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  off: { label: "Desligado", dot: "bg-slate-400", tone: "text-slate-600", chip: "bg-slate-100 text-slate-600 ring-slate-200" },
  offline: { label: "Sem sinal", dot: "bg-red-500", tone: "text-red-700", chip: "bg-red-50 text-red-700 ring-red-200" },
  awaiting: { label: "Aguardando 1º sinal", dot: "bg-slate-300", tone: "text-slate-500", chip: "bg-slate-50 text-slate-500 ring-slate-200" },
};

/**
 * Status único a partir de conexão, velocidade e ignição.
 * Prioridade: sem sinal > em movimento > parado ligado > desligado.
 */
export function vehicleStatus({ connection, speedKmh, ignition }) {
  if (connection === "awaiting") return "awaiting";
  if (connection === "offline") return "offline";
  if (speedKmh != null && Number(speedKmh) > MOVING_SPEED_KMH) return "moving";
  if (ignition === true) return "idle";
  return "off";
}

/** "agora", "há 3 min", "há 2 h", "há 3 dias". */
export function relativeTime(value, now = Date.now()) {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** @returns {{ value: number|null, plausible: boolean }} */
export function kmPerLiter(value) {
  const n = value == null ? null : Number(value);
  if (n == null || !Number.isFinite(n) || n <= 0) return { value: null, plausible: false };
  return {
    value: n,
    plausible: n >= PLAUSIBLE_KM_PER_L.min && n <= PLAUSIBLE_KM_PER_L.max,
  };
}

export function formatKm(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} km`;
}

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Agrupa pontos do histórico em viagens e paradas. Uma parada só conta se
 * durar pelo menos `minStopMs` (padrão 5 min); paradas curtas (semáforo,
 * trânsito) ficam dentro da viagem. Um intervalo maior que `maxGapMs` sem
 * pontos durante uma viagem (sem sinal) encerra a viagem.
 *
 * @param {Array<{lat:number,lng:number,speedKmh:number|null,when:string,ignition?:boolean,odometerKm?:number|null}>} points ordenados no tempo
 */
export function segmentTrips(points, { minStopMs = 5 * 60_000, maxGapMs = 20 * 60_000 } = {}) {
  const valid = (points || []).filter((p) => p && p.when && Number.isFinite(new Date(p.when).getTime()));
  if (valid.length < 2) return [];

  // 1) blocos crus de movimento / parado
  const blocks = [];
  for (let i = 0; i < valid.length; i += 1) {
    const p = valid[i];
    const moving = p.speedKmh != null && p.speedKmh > MOVING_SPEED_KMH;
    const last = blocks[blocks.length - 1];
    // Lacuna longa sem pontos (sem sinal / veículo desligado): fecha a viagem
    // e registra o intervalo como parada, em vez de "esticar" a viagem.
    const gap = i > 0 ? new Date(p.when).getTime() - new Date(valid[i - 1].when).getTime() : 0;
    if (last && last.moving && gap > maxGapMs) {
      blocks.push({ moving: false, start: i - 1, end: i - 1, gap: true });
      blocks.push({ moving, start: i, end: i });
      continue;
    }
    if (last && last.moving === moving) {
      last.end = i;
    } else {
      blocks.push({ moving, start: i, end: i });
    }
  }

  // 2) paradas curtas viram parte da viagem
  const merged = [];
  for (const b of blocks) {
    const startT = new Date(valid[b.start].when).getTime();
    const endT = new Date(valid[Math.min(b.end + 1, valid.length - 1)].when).getTime();
    const shortStop = !b.moving && endT - startT < minStopMs && merged.length && b.end < valid.length - 1;
    const prev = merged[merged.length - 1];
    if (shortStop || (prev && prev.moving === b.moving)) {
      if (prev) {
        prev.end = b.end;
        continue;
      }
    }
    merged.push({ ...b });
  }
  // funde viagens que ficaram adjacentes após absorver paradas curtas
  const out = [];
  for (const b of merged) {
    const prev = out[out.length - 1];
    if (prev && prev.moving === b.moving) prev.end = b.end;
    else out.push({ ...b });
  }

  return out.map((b) => {
    const slice = valid.slice(b.start, b.end + 1);
    const first = slice[0];
    // a parada termina quando o próximo bloco começa
    const nextPoint = valid[b.end + 1];
    const lastPoint = slice[slice.length - 1];
    const startAt = first.when;
    const endAt = b.moving ? lastPoint.when : (nextPoint || lastPoint).when;
    let km = null;
    if (b.moving) {
      const odoA = first.odometerKm;
      const odoB = lastPoint.odometerKm;
      if (odoA != null && odoB != null && odoB >= odoA) km = odoB - odoA;
      else {
        km = 0;
        for (let i = 1; i < slice.length; i += 1) km += haversineKm(slice[i - 1], slice[i]);
      }
    }
    const speeds = slice.map((p) => p.speedKmh).filter((v) => v != null && Number.isFinite(v));
    return {
      type: b.moving ? "trip" : "stop",
      startIndex: b.start,
      endIndex: b.end,
      startAt,
      endAt,
      durationMs: new Date(endAt).getTime() - new Date(startAt).getTime(),
      km,
      maxSpeedKmh: speeds.length ? Math.max(...speeds) : null,
      ignitionOn: !b.moving && slice.some((p) => p.ignition === true),
      at: { lat: first.lat, lng: first.lng },
    };
  });
}

export function googleMapsUrl(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
