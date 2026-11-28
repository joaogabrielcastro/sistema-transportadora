/**
 * Teltonika Codec 12: comandos de texto (os mesmos do SMS) enviados pelo
 * servidor na conexão TCP já aberta pelo aparelho, e a resposta dele.
 *
 *   00000000 | tamanho (4) | 0x0C | qtd 1 | tipo (1) | tamanho texto (4) | texto | qtd 1 | CRC16 (4)
 *
 * tipo 0x05 = comando (servidor → aparelho); 0x06 = resposta (aparelho → servidor).
 * O CRC-16/IBM cobre do codec até a segunda quantidade, como no Codec 8.
 * Referência: Teltonika Wiki — "Codec", seção "Codec 12".
 */
import { crc16Ibm } from "./codec8.js";

export const CODEC12 = 0x0c;
export const CODEC12_COMMAND = 0x05;
export const CODEC12_RESPONSE = 0x06;

/** Monta o pacote de um comando de texto (ex.: "getinfo", "setdigout 1???"). */
export function buildCodec12Command(text, type = CODEC12_COMMAND) {
  const body = Buffer.from(String(text), "ascii");
  const data = Buffer.alloc(1 + 1 + 1 + 4 + body.length + 1);
  let o = 0;
  data.writeUInt8(CODEC12, o); o += 1;
  data.writeUInt8(1, o); o += 1;
  data.writeUInt8(type, o); o += 1;
  data.writeUInt32BE(body.length, o); o += 4;
  body.copy(data, o); o += body.length;
  data.writeUInt8(1, o);
  const packet = Buffer.alloc(8 + data.length + 4);
  packet.writeUInt32BE(0, 0);
  packet.writeUInt32BE(data.length, 4);
  data.copy(packet, 8);
  packet.writeUInt32BE(crc16Ibm(data), 8 + data.length);
  return packet;
}

/** O pacote no início do buffer é Codec 12? (para separar de um AVL Codec 8/8E) */
export function isCodec12Packet(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 9 && buf.readUInt32BE(0) === 0 && buf.readUInt8(8) === CODEC12;
}

/**
 * Lê uma mensagem Codec 12 (normalmente a resposta do aparelho).
 * @returns {{ type: number, text: string, bytesConsumed: number } | null} null = pacote incompleto
 */
export function tryParseCodec12(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.readUInt32BE(0) !== 0) return null;
  const dataLength = buf.readUInt32BE(4);
  if (dataLength < 8 || dataLength > 64_000) {
    const err = new Error("Tamanho Codec 12 inválido.");
    err.code = "TELTONIKA_CODEC12";
    throw err;
  }
  const total = 8 + dataLength + 4;
  if (buf.length < total) return null;
  const data = buf.subarray(8, 8 + dataLength);
  if ((buf.readUInt32BE(8 + dataLength) & 0xffff) !== crc16Ibm(data)) {
    const err = new Error("CRC Teltonika inválido.");
    err.code = "TELTONIKA_CRC";
    throw err;
  }
  if (data.readUInt8(0) !== CODEC12) {
    const err = new Error("Pacote não é Codec 12.");
    err.code = "TELTONIKA_CODEC12";
    throw err;
  }
  const type = data.readUInt8(2);
  const size = data.readUInt32BE(3);
  if (7 + size + 1 > data.length) {
    const err = new Error("Texto Codec 12 maior que o pacote.");
    err.code = "TELTONIKA_CODEC12";
    throw err;
  }
  const text = data.subarray(7, 7 + size).toString("latin1");
  return { type, text, bytesConsumed: total };
}
