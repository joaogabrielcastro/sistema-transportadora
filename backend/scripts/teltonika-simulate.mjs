#!/usr/bin/env node
/**
 * Simulador TCP Teltonika (Codec 8 / 8E) para homologação local do ATrack.
 *
 * Valida: handshake IMEI, pacotes binários, ACK, fila, persistência e mapa.
 * NÃO comprova compatibilidade física com FMC650 nem instalação elétrica/CAN.
 *
 * Pré-requisitos:
 *   - worker com TELETONIKA_TCP_ENABLED=true (porta 5027)
 *   - device com IMEI cadastrado e veículo vinculado
 *     node scripts/_enable-telemetry-demo.mjs
 *
 * Exemplos (prefira --chave=valor; no Windows o npm às vezes engole --flags):
 *   node scripts/teltonika-simulate.mjs --imei=352094081111111 --count=20
 *   npm run telemetry:teltonika -- --codec=8e --route=curitiba --interval=1500
 *   node scripts/teltonika-simulate.mjs --waypoints=-25.4284,-49.2733;-25.4350,-49.2600 --disconnect-every=5
 */
import "dotenv/config";
import net from "node:net";
import {
  CODEC8,
  CODEC8_EXTENDED,
  buildAvlPacket,
  buildImeiHandshake,
} from "../src/services/telemetry/protocols/teltonika/codec8.js";
import {
  CODEC12_RESPONSE,
  buildCodec12Command,
  isCodec12Packet,
  tryParseCodec12,
} from "../src/services/telemetry/protocols/teltonika/codec12.js";

const ROUTES = {
  curitiba: [
    [-25.4284, -49.2733],
    [-25.4308, -49.2688],
    [-25.4335, -49.2642],
    [-25.4362, -49.2595],
    [-25.4388, -49.2551],
    [-25.4355, -49.2518],
    [-25.4312, -49.2545],
    [-25.4289, -49.2602],
    [-25.4271, -49.2668],
    [-25.4284, -49.2733],
  ],
  /** Rota paralela (norte) para 2º veículo no mesmo mapa sem sobrepor. */
  "curitiba-norte": [
    [-25.4184, -49.2733],
    [-25.4208, -49.2688],
    [-25.4235, -49.2642],
    [-25.4262, -49.2595],
    [-25.4288, -49.2551],
    [-25.4255, -49.2518],
    [-25.4212, -49.2545],
    [-25.4189, -49.2602],
    [-25.4171, -49.2668],
    [-25.4184, -49.2733],
  ],
  estacionado: [
    [-25.4284, -49.2733],
    [-25.42841, -49.27331],
    [-25.42839, -49.27329],
  ],
};

function arg(name, fallback = undefined) {
  const flag = `--${name}`;
  const eqPrefix = `${flag}=`;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(eqPrefix)) return raw.slice(eqPrefix.length);
  }
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}

function hasFlag(name) {
  return (
    process.argv.includes(`--${name}`) ||
    process.argv.some((a) => a.startsWith(`--${name}=`))
  );
}

function usage() {
  console.log(`Uso:
  npm run telemetry:teltonika -- [opções]

Opções:
  --host <ip>                 padrão 127.0.0.1
  --port <n>                  padrão TELETONIKA_TCP_PORT ou 5027
  --imei <15 dígitos>         padrão TELETONIKA_SIM_IMEI ou demo abbroto
  --codec 8|8e                padrão 8
  --count <n>                 pontos a enviar (1..500), padrão 24
  --interval <ms>             pausa entre pacotes, padrão 2000
  --route curitiba|curitiba-norte|estacionado
  --waypoints "lat,lng;..."   sobrescreve a rota
  --steps-per-segment <n>     interpolação entre waypoints (padrão 12)
  --speed <km/h>              base de velocidade (padrão 42)
  --odometer-start <km>       odômetro inicial (padrão 120000)
  --ignition on|off|toggle    padrão on
  --batch <n>                 records por pacote AVL (1..10), padrão 1
  --disconnect-every <n>      fecha TCP a cada N pacotes (0=off)
  --reconnect-delay <ms>      espera antes de reconectar (padrão 1500)
  --ack-timeout <ms>          timeout do ACK (padrão 8000)
  --voltage <V>               tensão da bateria do veículo (IO 66), padrão 27.6
  --ibutton <hex>             iButton do motorista (IO 78, só FMB130 com leitor)
  --profile fmb|fms           fms = FMC650: consumo (IO 86), tanque (87) e
                              rotação (88) lidos do caminhão; padrão fmb
  --driving-events            injeta eventos de condução (frenagem, aceleração,
                              curva e excesso de velocidade) para demonstração
  --help
`);
}

function parseWaypoints(raw) {
  if (!raw || raw === true) return null;
  return String(raw)
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [lat, lng] = pair.split(",").map((x) => Number(String(x).trim()));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`Waypoint inválido: ${pair}`);
      }
      return [lat, lng];
    });
}

function bearingDeg(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Densifica waypoints com interpolação linear (percurso contínuo, sem “pulo”). */
function densifyRoute(waypoints, stepsPerSegment = 10) {
  if (!waypoints?.length) return [];
  if (waypoints.length === 1) return [[waypoints[0][0], waypoints[0][1]]];
  const steps = Math.max(1, Math.min(40, Number(stepsPerSegment) || 10));
  const dense = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      dense.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  const last = waypoints[waypoints.length - 1];
  dense.push([last[0], last[1]]);
  return dense;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Leitor único por conexão: separa os comandos Codec 12 enviados pelo
 * servidor (respondidos como um aparelho real faria) dos bytes de handshake/ACK.
 */
const readers = new WeakMap();
function readerFor(socket) {
  if (readers.has(socket)) return readers.get(socket);
  const state = { buf: Buffer.alloc(0), waiters: [], dout1: 0 };
  const pump = () => {
    for (;;) {
      if (isCodec12Packet(state.buf)) {
        const msg = tryParseCodec12(state.buf);
        if (!msg) return;
        state.buf = state.buf.subarray(msg.bytesConsumed);
        const m = /^setdigout\s+([01?])/i.exec(msg.text);
        if (m && m[1] !== "?") state.dout1 = Number(m[1]);
        const reply = m ? `DOUT1:${state.dout1} DOUT2:IGNORED` : `ERR:Unknown command`;
        console.log(`[comando] recebido "${msg.text}" → respondendo "${reply}"`);
        socket.write(buildCodec12Command(reply, CODEC12_RESPONSE));
        continue;
      }
      const w = state.waiters[0];
      if (!w || state.buf.length < w.size) return;
      state.waiters.shift();
      const out = state.buf.subarray(0, w.size);
      state.buf = state.buf.subarray(w.size);
      w.done(null, out);
    }
  };
  socket.on("data", (chunk) => {
    state.buf = Buffer.concat([state.buf, chunk]);
    pump();
  });
  socket.on("close", () => {
    for (const w of state.waiters.splice(0)) w.done(new Error("socket fechado antes do ACK"));
  });
  socket.on("error", (err) => {
    for (const w of state.waiters.splice(0)) w.done(err);
  });
  const api = {
    readExact(size, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const i = state.waiters.indexOf(waiter);
          if (i >= 0) state.waiters.splice(i, 1);
          reject(new Error(`timeout aguardando ${size} byte(s) do servidor`));
        }, timeoutMs);
        const waiter = {
          size,
          done: (err, out) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve(out);
          },
        };
        state.waiters.push(waiter);
        pump();
      });
    },
  };
  readers.set(socket, api);
  return api;
}

function readExact(socket, size, timeoutMs) {
  return readerFor(socket).readExact(size, timeoutMs);
}

function connect(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function handshake(socket, imei, ackTimeout) {
  socket.write(buildImeiHandshake(imei));
  const resp = await readExact(socket, 1, ackTimeout);
  if (resp[0] !== 0x01) {
    throw new Error(
      `IMEI rejeitado (0x${resp[0].toString(16)}). Cadastre o device com este IMEI e vincule um veículo.`,
    );
  }
}

async function sendPacket(socket, packet, expectedRecords, ackTimeout) {
  socket.write(packet);
  const ack = await readExact(socket, 4, ackTimeout);
  const accepted = ack.readUInt32BE(0);
  if (accepted !== expectedRecords) {
    throw new Error(
      `ACK inesperado: servidor respondeu ${accepted}, esperado ${expectedRecords}`,
    );
  }
  return accepted;
}

if (hasFlag("help")) {
  usage();
  process.exit(0);
}

const host = String(arg("host", "127.0.0.1"));
const port = Number(arg("port", process.env.TELETONIKA_TCP_PORT || "5027"));
const imei = String(
  arg("imei", process.env.TELETONIKA_SIM_IMEI || "352094081111111"),
).trim();
const codecArg = String(arg("codec", "8")).toLowerCase();
const codecId = codecArg === "8e" || codecArg === "8ext" ? CODEC8_EXTENDED : CODEC8;
const count = Number(arg("count", "24"));
const intervalMs = Number(arg("interval", "2000"));
const speedBase = Number(arg("speed", "42"));
const odometerStartKm = Number(arg("odometer-start", "120000"));
const batch = Number(arg("batch", "1"));
const disconnectEvery = Number(arg("disconnect-every", "0"));
const reconnectDelay = Number(arg("reconnect-delay", "1500"));
const ackTimeout = Number(arg("ack-timeout", "8000"));
const ignitionMode = String(arg("ignition", "on")).toLowerCase();
const routeName = String(arg("route", "curitiba"));
const voltageV = Number(arg("voltage", "27.6"));
const ibuttonRaw = arg("ibutton");
const ibuttonHex =
  ibuttonRaw && ibuttonRaw !== true
    ? String(ibuttonRaw).replace(/[^0-9a-fA-F]/g, "").toUpperCase().padStart(16, "0").slice(-16)
    : null;
const drivingEvents = hasFlag("driving-events");
const fmsProfile = String(arg("profile", "fmb")).toLowerCase() === "fms";
// Ciclo de eventos de demonstração: [tipo green driving (1/2/3) | overspeed]
const DEMO_EVENTS = [
  { every: 7, type: 2, value: 48 }, // frenagem brusca 0,48 g
  { every: 11, type: 1, value: 36 }, // aceleração brusca 0,36 g
  { every: 13, type: 3, value: 41 }, // curva brusca
  { every: 9, overspeed: true },
];
const stepsPerSegment = Number(arg("steps-per-segment", "12"));

let rawPoints;
try {
  rawPoints = parseWaypoints(arg("waypoints")) || ROUTES[routeName];
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

if (!rawPoints?.length) {
  console.error(`Rota desconhecida: ${routeName}. Use curitiba|estacionado ou --waypoints.`);
  process.exit(1);
}

const points =
  routeName === "estacionado"
    ? rawPoints
    : densifyRoute(rawPoints, stepsPerSegment);
if (!/^\d{10,16}$/.test(imei)) {
  console.error("IMEI inválido (10–16 dígitos).");
  process.exit(1);
}
if (!Number.isInteger(count) || count < 1 || count > 500) {
  console.error("--count deve ser 1..500");
  process.exit(1);
}
if (!Number.isInteger(batch) || batch < 1 || batch > 10) {
  console.error("--batch deve ser 1..10");
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("porta inválida");
  process.exit(1);
}

function buildRecords(startIndex, n, state) {
  const records = [];
  for (let i = 0; i < n; i += 1) {
    const idx = startIndex + i;
    const from = points[idx % points.length];
    const to = points[(idx + 1) % points.length];
    const moving = routeName !== "estacionado";
    let speed = moving ? speedBase + (idx % 17) : 0;
    let ignition = true;
    if (ignitionMode === "off") ignition = false;
    if (ignitionMode === "toggle") ignition = idx % 6 !== 5;
    // Evento: a cada 8 pontos simula freada / ignição off pontual
    if (idx > 0 && idx % 8 === 0) {
      speed = Math.max(0, Math.round(speed * 0.2));
    }

    const angle = Math.round(bearingDeg(from, to));
    // Odômetro avança pela velocidade simulada × intervalo (não pela corda do waypoint).
    const stepM = moving ? (speed / 3.6) * (intervalMs / 1000) : 0;
    state.odometerM += stepM;
    state.recordedAt += intervalMs;
    if (moving && stepM > 0) {
      const liters = stepM / 1000 / DEMO_KM_PER_LITER;
      state.fuelUsedMl += liters * 1000;
      state.fuelLevelPct = Math.max(
        5,
        state.fuelLevelPct - (liters / TANK_LITERS) * 100,
      );
    }

    // IOs permanentes do FMB: tensão externa (mV), sinal GSM e iButton.
    const io = {
      ones: [{ id: 21, value: 3 + (idx % 3) }],
      twos: Number.isFinite(voltageV) ? [{ id: 66, value: Math.round(voltageV * 1000) }] : [],
      eights: ibuttonHex ? [{ id: 78, value: ibuttonHex }] : [],
    };
    let eventIoId = ignition ? 239 : 0;
    if (drivingEvents && moving && idx > 0) {
      const ev = DEMO_EVENTS.find((e) => idx % e.every === 0);
      if (ev?.overspeed) {
        speed = Math.max(speed, 95 + (idx % 15));
        io.ones.push({ id: 255, value: speed });
        eventIoId = 255;
      } else if (ev) {
        io.ones.push({ id: 253, value: ev.type }, { id: 254, value: ev.value });
        eventIoId = 253;
      }
    }

    if (fmsProfile) {
      // FMC650: dados do motor pela FMS (litros inteiros, %, rpm).
      io.ones.push({ id: 87, value: Math.round(state.fuelLevelPct) });
      io.ones.push({ id: 127, value: 40 + 82 + (idx % 6) }); // 82–87 °C (byte − 40)
      io.twos.push({ id: 88, value: speed > 0 ? 1100 + Math.round(speed * 6) : ignition ? 650 : 0 });
      // contador do motor de um caminhão já rodado (~150 mil litros)
      io.fours = [{ id: 86, value: 150_000 + Math.round(state.fuelUsedMl / 1000) }];
    }

    records.push({
      io,
      recordedAt: new Date(state.recordedAt),
      latitude: from[0],
      longitude: from[1],
      speedKmh: speed,
      ignition,
      altitude: 900 + (idx % 20),
      angle,
      satellites: 10 + (idx % 5),
      odometerM: Math.round(state.odometerM),
      fuelUsedMl: fmsProfile ? undefined : Math.round(state.fuelUsedMl),
      fuelLevelPct: fmsProfile ? undefined : Math.round(state.fuelLevelPct),
      eventIoId,
      priority: idx % 8 === 0 ? 1 : 0,
    });
  }
  return records;
}

const stats = {
  connected: 0,
  packets: 0,
  records: 0,
  acked: 0,
  disconnects: 0,
  errors: 0,
};

/** Consumo médio simulado de carreta (km/L) — só para demo visual. */
const DEMO_KM_PER_LITER = 2.85;
const TANK_LITERS = 600;

const state = {
  odometerM: odometerStartKm * 1000,
  // Timestamps ao vivo (não backdatar o lote inteiro — evita “sem vínculo”
  // quando o device acabou de ser cadastrado).
  recordedAt: Date.now(),
  fuelUsedMl: 0,
  fuelLevelPct: 78,
};

console.log(
  JSON.stringify(
    {
      mode: "teltonika-tcp-simulator",
      host,
      port,
      imei,
      codec: codecId === CODEC8_EXTENDED ? "8E" : "8",
      count,
      batch,
      route: arg("waypoints") ? "custom" : routeName,
      note:
        "Homologa protocolo TCP/Codec e pipeline ATrack. Não valida FMC650 físico nem CAN do veículo.",
    },
    null,
    2,
  ),
);

let socket = null;
let sentPackets = 0;
let index = 0;

try {
  while (index < count) {
    if (!socket || socket.destroyed) {
      socket = await connect(host, port);
      socket.setTimeout(ackTimeout + 5_000);
      await handshake(socket, imei, ackTimeout);
      stats.connected += 1;
      console.log(`[ok] IMEI aceito (${imei})`);
    }

    const n = Math.min(batch, count - index);
    const records = buildRecords(index, n, state);
    const packet = buildAvlPacket({ codecId, records });
    const accepted = await sendPacket(socket, packet, records.length, ackTimeout);

    stats.packets += 1;
    stats.records += records.length;
    stats.acked += accepted;
    sentPackets += 1;
    index += n;

    const last = records[records.length - 1];
    console.log(
      `[pkt ${stats.packets}] records=${records.length} ack=${accepted} ` +
        `lat=${last.latitude.toFixed(5)} lng=${last.longitude.toFixed(5)} ` +
        `v=${last.speedKmh} ign=${last.ignition ? 1 : 0} odo=${(last.odometerM / 1000).toFixed(1)}km`,
    );

    if (
      disconnectEvery > 0 &&
      sentPackets % disconnectEvery === 0 &&
      index < count
    ) {
      stats.disconnects += 1;
      console.log(`[sim] desconectando (reconecta em ${reconnectDelay}ms)`);
      socket.end();
      socket.destroy();
      socket = null;
      await sleep(reconnectDelay);
      continue;
    }

    if (index < count) await sleep(intervalMs);
  }
} catch (err) {
  stats.errors += 1;
  console.error(`[erro] ${err.message}`);
  process.exitCode = 1;
} finally {
  if (socket && !socket.destroyed) {
    socket.end();
    socket.destroy();
  }
}

console.log(JSON.stringify({ result: stats }, null, 2));
if (stats.errors === 0 && stats.acked === stats.records) {
  console.log(
    "Pronto. Confira /telemetria/mapa (atualiza ~10s) e o health do worker /health (teltonika).",
  );
}
