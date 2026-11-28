/**
 * Teltonika Codec 8 / Codec 8 Extended — GPS, todos os IOs e eventos.
 * Spec: Teltonika Data Sending Protocols (AVL).
 */
import {
  interpretTeltonikaIo,
  ioMapToJson,
  teltonikaDrivingEvents,
} from "./teltonikaIo.js";

export const CODEC8 = 0x08;
export const CODEC8_EXTENDED = 0x8e;

/** IO ID clássico Teltonika para ignição. */
export const IO_IGNITION = 239;
/** Total Odometer (metros) — AVL ID 16, U32. */
export const IO_ODOMETER = 16;
/** Fuel Used GPS — AVL ID 12, U32 em mililitros. */
export const IO_FUEL_USED_ML = 12;
/** Fuel Level — AVL ID 89, U8 percentual (0–100). */
export const IO_FUEL_LEVEL_PCT = 89;

/**
 * CRC-16/IBM (ARC), poly 0xA001, init 0.
 * @param {Buffer} buf
 */
export function crc16Ibm(buf) {
  let crc = 0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xa001;
      else crc >>>= 1;
    }
  }
  return crc & 0xffff;
}

/**
 * @param {Buffer} buf
 * @returns {{ imei: string, bytesConsumed: number } | null}
 */
export function tryParseImeiHandshake(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 3) return null;
  const imeiLen = buf.readUInt16BE(0);
  if (imeiLen < 1 || imeiLen > 16) return null;
  if (buf.length < 2 + imeiLen) return null;
  const imei = buf.subarray(2, 2 + imeiLen).toString("ascii").trim();
  if (!/^\d{10,16}$/.test(imei)) return null;
  return { imei, bytesConsumed: 2 + imeiLen };
}

export function imeiAcceptResponse() {
  return Buffer.from([0x01]);
}

export function imeiRejectResponse() {
  return Buffer.from([0x00]);
}

/**
 * @param {string} imei
 * @param {string|Date|number} recordedAt
 * @param {number} index
 */
export function buildTeltonikaEventId(imei, recordedAt, index) {
  const ts = new Date(recordedAt).getTime();
  const raw = `${imei}-${ts}-${index}`;
  return raw.slice(0, 80);
}

function readIoMap(buf, offset, codecId) {
  const extended = codecId === CODEC8_EXTENDED;
  const idSize = extended ? 2 : 1;
  const countSize = extended ? 2 : 1;
  let o = offset;
  const map = new Map();

  const readId = () => {
    if (idSize === 2) {
      const id = buf.readUInt16BE(o);
      o += 2;
      return id;
    }
    const id = buf.readUInt8(o);
    o += 1;
    return id;
  };

  const readCount = () => {
    if (countSize === 2) {
      const n = buf.readUInt16BE(o);
      o += 2;
      return n;
    }
    const n = buf.readUInt8(o);
    o += 1;
    return n;
  };

  const n1 = readCount();
  for (let i = 0; i < n1; i += 1) {
    const id = readId();
    const value = buf.readUInt8(o);
    o += 1;
    map.set(id, value);
  }

  const n2 = readCount();
  for (let i = 0; i < n2; i += 1) {
    const id = readId();
    const value = buf.readUInt16BE(o);
    o += 2;
    map.set(id, value);
  }

  const n4 = readCount();
  for (let i = 0; i < n4; i += 1) {
    const id = readId();
    const value = buf.readUInt32BE(o);
    o += 4;
    map.set(id, value);
  }

  const n8 = readCount();
  for (let i = 0; i < n8; i += 1) {
    const id = readId();
    // 8 bytes (ex.: iButton) não cabem em Number com precisão: guarda em hex.
    map.set(id, buf.subarray(o, o + 8).toString("hex").toUpperCase());
    o += 8;
  }

  // Codec 8E: seção de IOs de tamanho variável (NX) após os de 8 bytes.
  if (extended) {
    const nx = readCount();
    for (let i = 0; i < nx; i += 1) {
      const id = readId();
      const len = buf.readUInt16BE(o);
      o += 2;
      map.set(id, buf.subarray(o, o + len).toString("hex").toUpperCase());
      o += len;
    }
  }

  return { map, offset: o };
}

/**
 * @param {Buffer} buf
 * @param {number} offset
 * @param {number} codecId
 */
function parseAvlRecord(buf, offset, codecId) {
  let o = offset;
  const timestampMs = Number(buf.readBigUInt64BE(o));
  o += 8;
  o += 1; // priority
  const longitude = buf.readInt32BE(o) / 10_000_000;
  o += 4;
  const latitude = buf.readInt32BE(o) / 10_000_000;
  o += 4;
  const altitude = buf.readInt16BE(o);
  o += 2;
  const angle = buf.readUInt16BE(o);
  o += 2;
  const satellites = buf.readUInt8(o);
  o += 1;
  const speed = buf.readUInt16BE(o);
  o += 2;

  let eventIoId;
  if (codecId === CODEC8_EXTENDED) {
    eventIoId = buf.readUInt16BE(o);
    o += 2;
    o += 2; // total IO count (2 bytes in 8E)
  } else {
    eventIoId = buf.readUInt8(o);
    o += 1;
    o += 1; // N of total IO
  }

  const io = readIoMap(buf, o, codecId);
  const parsed = interpretTeltonikaIo(io.map);
  const ignition = parsed.ignition ?? false;
  const { odometerKm, fuelConsumedL, fuelLevelPct, batteryV, gsmSignal, ibutton } = parsed;
  const drivingEvents = teltonikaDrivingEvents({ eventIoId, io: io.map, speedKmh: speed });

  return {
    recordedAt: new Date(timestampMs),
    latitude,
    longitude,
    altitudeM: altitude,
    heading: angle,
    satellites,
    speedKmh: speed,
    ignition,
    odometerKm,
    fuelConsumedL,
    fuelLevelPct,
    batteryV,
    gsmSignal,
    ibutton,
    eventIoId: eventIoId || null,
    io: ioMapToJson(io.map),
    drivingEvents,
    nextOffset: io.offset,
  };
}

/**
 * Tenta extrair um pacote AVL completo do buffer.
 * @param {Buffer} buf
 * @returns {{ records: object[], bytesConsumed: number, recordCount: number } | null}
 */
export function tryParseAvlPacket(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.readUInt32BE(0) !== 0) return null;

  const dataLength = buf.readUInt32BE(4);
  if (dataLength < 3 || dataLength > 128_000) return null;
  const totalNeeded = 8 + dataLength + 4;
  if (buf.length < totalNeeded) return null;

  const dataField = buf.subarray(8, 8 + dataLength);
  const crcExpected = buf.readUInt32BE(8 + dataLength) & 0xffff;
  const crcActual = crc16Ibm(dataField);
  if (crcExpected !== crcActual) {
    const err = new Error("CRC Teltonika inválido.");
    err.code = "TELTONIKA_CRC";
    throw err;
  }

  const codecId = dataField.readUInt8(0);
  if (codecId !== CODEC8 && codecId !== CODEC8_EXTENDED) {
    const err = new Error(`Codec Teltonika não suportado: 0x${codecId.toString(16)}`);
    err.code = "TELTONIKA_CODEC";
    throw err;
  }

  const count1 = dataField.readUInt8(1);
  let offset = 2;
  const records = [];
  for (let i = 0; i < count1; i += 1) {
    const rec = parseAvlRecord(dataField, offset, codecId);
    records.push(rec);
    offset = rec.nextOffset;
  }

  const count2 = dataField.readUInt8(offset);
  if (count1 !== count2) {
    const err = new Error("Contagem AVL inconsistente.");
    err.code = "TELTONIKA_COUNT";
    throw err;
  }

  return {
    codecId,
    recordCount: count1,
    records: records.map(({ nextOffset: _ignored, ...rec }) => rec),
    bytesConsumed: totalNeeded,
  };
}

/** Resposta ao dispositivo: quantidade de records aceitos (4 bytes BE). */
export function avlAck(recordCount) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(Number(recordCount) >>> 0, 0);
  return buf;
}

/**
 * @param {number} codecId
 * @param {{ eventIoId?: number, ones?: Array<{id:number,value:number}>, twos?: Array<{id:number,value:number}>, fours?: Array<{id:number,value:number}>, eights?: Array<{id:number,value:number}> }} io
 */
function encodeIoBlock(codecId, io = {}) {
  const extended = codecId === CODEC8_EXTENDED;
  const ones = io.ones || [];
  const twos = io.twos || [];
  const fours = io.fours || [];
  const eights = io.eights || [];
  const total = ones.length + twos.length + fours.length + eights.length;
  const eventIoId = Number(io.eventIoId ?? 0) || 0;

  const parts = [];
  const pushU8 = (n) => {
    const b = Buffer.alloc(1);
    b.writeUInt8(n, 0);
    parts.push(b);
  };
  const pushU16 = (n) => {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(n, 0);
    parts.push(b);
  };
  const pushId = (id) => (extended ? pushU16(id) : pushU8(id));
  const pushCount = (n) => (extended ? pushU16(n) : pushU8(n));

  if (extended) {
    pushU16(eventIoId);
    pushU16(total);
  } else {
    pushU8(eventIoId);
    pushU8(total);
  }

  pushCount(ones.length);
  for (const item of ones) {
    pushId(item.id);
    pushU8(Number(item.value) & 0xff);
  }
  pushCount(twos.length);
  for (const item of twos) {
    pushId(item.id);
    pushU16(Number(item.value) & 0xffff);
  }
  pushCount(fours.length);
  for (const item of fours) {
    pushId(item.id);
    const b = Buffer.alloc(4);
    b.writeUInt32BE(Number(item.value) >>> 0, 0);
    parts.push(b);
  }
  pushCount(eights.length);
  for (const item of eights) {
    pushId(item.id);
    const b = Buffer.alloc(8);
    // String = hexadecimal (ex.: iButton "01A2B3C4D5E6F708"); número = decimal.
    b.writeBigUInt64BE(
      typeof item.value === "string" ? BigInt(`0x${item.value}`) : BigInt(item.value),
      0,
    );
    parts.push(b);
  }
  if (extended) {
    pushU16(0); // NX: nenhum IO de tamanho variável nos pacotes de teste
  }

  return Buffer.concat(parts);
}

/**
 * @param {number} codecId
 * @param {object} rec
 */
function encodeAvlRecord(codecId, rec) {
  const ones = [{ id: IO_IGNITION, value: rec.ignition ? 1 : 0 }];
  if (rec.fuelLevelPct != null && Number.isFinite(Number(rec.fuelLevelPct))) {
    ones.push({
      id: IO_FUEL_LEVEL_PCT,
      value: Math.max(0, Math.min(100, Math.round(Number(rec.fuelLevelPct)))),
    });
  }
  const fours = [];
  if (rec.odometerM != null && Number.isFinite(Number(rec.odometerM))) {
    fours.push({ id: IO_ODOMETER, value: Math.max(0, Math.round(Number(rec.odometerM))) });
  }
  if (rec.fuelUsedMl != null && Number.isFinite(Number(rec.fuelUsedMl))) {
    fours.push({
      id: IO_FUEL_USED_ML,
      value: Math.max(0, Math.round(Number(rec.fuelUsedMl))),
    });
  }
  // IOs extras (ex.: eventos de condução, tensão, iButton) para simulação/testes.
  const extra = rec.io || {};
  const io = encodeIoBlock(codecId, {
    eventIoId: rec.eventIoId ?? IO_IGNITION,
    ones: [...ones, ...(extra.ones || [])],
    twos: [...(extra.twos || [])],
    fours: [...fours, ...(extra.fours || [])],
    eights: [...(extra.eights || [])],
  });

  const record = Buffer.alloc(8 + 1 + 4 + 4 + 2 + 2 + 1 + 2 + io.length);
  let r = 0;
  record.writeBigUInt64BE(BigInt(new Date(rec.recordedAt).getTime()), r);
  r += 8;
  record.writeUInt8(Number(rec.priority ?? 0) & 0xff, r);
  r += 1;
  record.writeInt32BE(Math.round(Number(rec.longitude) * 10_000_000), r);
  r += 4;
  record.writeInt32BE(Math.round(Number(rec.latitude) * 10_000_000), r);
  r += 4;
  record.writeInt16BE(Number(rec.altitude ?? 0), r);
  r += 2;
  record.writeUInt16BE(Number(rec.angle ?? 0) & 0xffff, r);
  r += 2;
  record.writeUInt8(Number(rec.satellites ?? 12) & 0xff, r);
  r += 1;
  record.writeUInt16BE(Number(rec.speedKmh ?? 0) & 0xffff, r);
  r += 2;
  io.copy(record, r);
  return record;
}

/**
 * Monta pacote AVL Codec 8 ou 8E com N records.
 * @param {{ codecId?: number, records: object[] }} opts
 */
export function buildAvlPacket({ codecId = CODEC8, records = [] } = {}) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 255) {
    throw new Error("AVL records: informe de 1 a 255 registros.");
  }
  if (codecId !== CODEC8 && codecId !== CODEC8_EXTENDED) {
    throw new Error(`Codec não suportado: 0x${Number(codecId).toString(16)}`);
  }

  const encoded = records.map((rec) => encodeAvlRecord(codecId, rec));
  const recordsSize = encoded.reduce((sum, buf) => sum + buf.length, 0);
  const dataField = Buffer.alloc(2 + recordsSize + 1);
  dataField.writeUInt8(codecId, 0);
  dataField.writeUInt8(records.length, 1);
  let offset = 2;
  for (const buf of encoded) {
    buf.copy(dataField, offset);
    offset += buf.length;
  }
  dataField.writeUInt8(records.length, offset);

  const packet = Buffer.alloc(8 + dataField.length + 4);
  packet.writeUInt32BE(0, 0);
  packet.writeUInt32BE(dataField.length, 4);
  dataField.copy(packet, 8);
  packet.writeUInt32BE(crc16Ibm(dataField), 8 + dataField.length);
  return packet;
}

/**
 * Monta um pacote Codec 8 mínimo (1 record) para testes.
 * @param {object} opts
 */
export function buildCodec8TestPacket(opts = {}) {
  return buildAvlPacket({
    codecId: CODEC8,
    records: [
      {
        recordedAt: opts.recordedAt ?? new Date("2026-09-21T12:00:00.000Z"),
        latitude: opts.latitude ?? -25.4284,
        longitude: opts.longitude ?? -49.2733,
        speedKmh: opts.speedKmh ?? 72,
        ignition: opts.ignition ?? true,
        altitude: opts.altitude ?? 900,
        angle: opts.angle ?? 90,
        satellites: opts.satellites ?? 12,
        odometerM: opts.odometerM,
        eventIoId: opts.eventIoId,
      },
    ],
  });
}

/**
 * Pacote Codec 8 Extended (1+ records).
 * @param {object} opts
 */
export function buildCodec8ETestPacket(opts = {}) {
  const records = opts.records || [
    {
      recordedAt: opts.recordedAt ?? new Date("2026-09-21T12:00:00.000Z"),
      latitude: opts.latitude ?? -25.4284,
      longitude: opts.longitude ?? -49.2733,
      speedKmh: opts.speedKmh ?? 72,
      ignition: opts.ignition ?? true,
      altitude: opts.altitude ?? 900,
      angle: opts.angle ?? 90,
      satellites: opts.satellites ?? 12,
      odometerM: opts.odometerM,
      eventIoId: opts.eventIoId,
    },
  ];
  return buildAvlPacket({ codecId: CODEC8_EXTENDED, records });
}

/**
 * Handshake IMEI (2 bytes len + ASCII).
 * @param {string} imei
 */
export function buildImeiHandshake(imei) {
  const body = Buffer.from(String(imei), "ascii");
  const buf = Buffer.alloc(2 + body.length);
  buf.writeUInt16BE(body.length, 0);
  body.copy(buf, 2);
  return buf;
}
