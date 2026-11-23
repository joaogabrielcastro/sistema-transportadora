import prisma from "../../lib/prisma.js";
import { isFmsModel } from "./protocols/teltonika/teltonikaIo.js";

/**
 * Comandos ao rastreador (bloqueio/desbloqueio do motor).
 *
 * O bloqueio liga a saída DOUT1 do aparelho, que aciona o relé instalado no
 * caminhão (corte da bomba de combustível ou da partida). Regras de
 * segurança, aplicadas ao pedir E de novo na hora de enviar:
 *  - bloquear só com o veículo parado (≤ 5 km/h) e posição recebida nos
 *    últimos 5 minutos; desbloquear é sempre permitido;
 *  - um comando por vez por aparelho;
 *  - comando não entregue em 2 minutos expira (nunca chega atrasado com o
 *    caminhão já andando);
 *  - só administradores pedem; quem pediu, quando e a resposta ficam gravados.
 */
export const COMMAND_ACTIONS = Object.freeze(["bloquear", "desbloquear"]);
export const BLOCK_MAX_SPEED_KMH = 5;
export const BLOCK_MAX_POSITION_AGE_MS = 5 * 60_000;
export const COMMAND_EXPIRE_MS = 2 * 60_000;
export const COMMAND_ANSWER_TIMEOUT_MS = 60_000;

const httpError = (message, status, code) => {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = code;
  return err;
};

/** Quantas saídas digitais o modelo tem (define a sintaxe do setdigout). */
function doutCount(model) {
  const m = String(model || "").toUpperCase();
  if (isFmsModel(m)) return 4; // FMC650, FMM650, FMC640, FMB640
  if (/FM[BC]9[12]0/.test(m)) return 1; // FMB920/FMC920
  return 2; // FMB130/FMC130/FMC125 e similares
}

/**
 * Texto do comando Teltonika para DOUT1. "?" deixa as outras saídas como estão.
 * @param {"bloquear"|"desbloquear"} acao
 */
export function commandTextFor(acao, model) {
  const state = acao === "bloquear" ? "1" : "0";
  return `setdigout ${state}${"?".repeat(doutCount(model) - 1)}`;
}

/** Interpreta a resposta do aparelho ao setdigout. */
export function commandSucceeded(responseText) {
  const t = String(responseText || "");
  if (!t.trim()) return false;
  return !/ERR|not executed|NOFIX|bad syntax/i.test(t);
}

/**
 * O veículo pode ser bloqueado agora? Usa o último estado recebido.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export async function checkBlockSafety(caminhaoId, now = Date.now()) {
  const state = await prisma.telemetry_current_state.findUnique({
    where: { caminhao_id: Number(caminhaoId) },
    select: { velocidade_kmh: true, registrado_em: true },
  });
  if (!state) return { ok: false, reason: "Sem posição do veículo: não dá para confirmar que está parado." };
  const age = now - new Date(state.registrado_em).getTime();
  if (age > BLOCK_MAX_POSITION_AGE_MS) {
    return { ok: false, reason: "Última posição tem mais de 5 minutos: não dá para confirmar que o veículo está parado." };
  }
  const speed = state.velocidade_kmh == null ? null : Number(state.velocidade_kmh);
  if (speed == null || speed > BLOCK_MAX_SPEED_KMH) {
    return { ok: false, reason: `Veículo em movimento (${speed ?? "?"} km/h). O bloqueio só é enviado com o veículo parado.` };
  }
  return { ok: true };
}

function mapCommand(c) {
  return {
    id: c.id,
    caminhao_id: c.caminhao_id,
    device_id: c.device_id,
    acao: c.acao,
    comando: c.comando,
    status: c.status,
    resposta: c.resposta,
    erro: c.erro,
    criado_por: c.criado_por,
    criado_por_nome: c.users?.nome ?? null,
    criado_em: c.criado_em,
    enviado_em: c.enviado_em,
    respondido_em: c.respondido_em,
    expira_em: c.expira_em,
  };
}

/** Pede um comando para o veículo (via o aparelho vinculado a ele). */
export async function createDeviceCommand(tenantId, userId, { caminhaoId, acao }) {
  const tid = Number(tenantId);
  if (!COMMAND_ACTIONS.includes(acao)) throw httpError("Ação inválida.", 400, "COMMAND_ACTION");
  const assignment = await prisma.telemetry_device_assignments.findFirst({
    where: { tenant_id: tid, caminhao_id: Number(caminhaoId), fim_em: null },
    include: { devices: true },
  });
  const device = assignment?.devices;
  if (!device || !device.ativo || device.revogado_em) {
    throw httpError("O veículo não tem rastreador ativo vinculado.", 404, "COMMAND_NO_DEVICE");
  }
  if (String(device.protocol || "").toLowerCase() !== "teltonika") {
    throw httpError("Comandos só estão disponíveis para rastreadores Teltonika.", 422, "COMMAND_PROTOCOL");
  }
  const busy = await prisma.telemetry_device_commands.findFirst({
    where: { device_id: device.id, status: { in: ["pendente", "enviado"] } },
    select: { id: true },
  });
  if (busy) throw httpError("Já existe um comando em andamento para este rastreador.", 409, "COMMAND_BUSY");
  if (acao === "bloquear") {
    const safety = await checkBlockSafety(caminhaoId);
    if (!safety.ok) throw httpError(safety.reason, 409, "COMMAND_UNSAFE");
  }
  const created = await prisma.telemetry_device_commands.create({
    data: {
      tenant_id: tid,
      device_id: device.id,
      caminhao_id: Number(caminhaoId),
      acao,
      comando: commandTextFor(acao, device.model),
      status: "pendente",
      criado_por: userId != null ? Number(userId) : null,
      expira_em: new Date(Date.now() + COMMAND_EXPIRE_MS),
    },
    include: { users: { select: { nome: true } } },
  });
  return mapCommand(created);
}

export async function listDeviceCommands(tenantId, { caminhaoId, limit = 20 } = {}) {
  const rows = await prisma.telemetry_device_commands.findMany({
    where: {
      tenant_id: Number(tenantId),
      ...(caminhaoId ? { caminhao_id: Number(caminhaoId) } : {}),
    },
    orderBy: { criado_em: "desc" },
    take: Math.min(Math.max(Number(limit) || 20, 1), 100),
    include: { users: { select: { nome: true } } },
  });
  return rows.map(mapCommand);
}

// ——— Lado do gateway TCP (worker) ———

/** Pendentes que passaram do prazo viram "expirado"; enviados sem resposta, "falhou". */
export async function expireStaleCommands(now = new Date()) {
  await prisma.telemetry_device_commands.updateMany({
    where: { status: "pendente", expira_em: { lt: now } },
    data: { status: "expirado", erro: "Rastreador não se conectou a tempo; comando não enviado." },
  });
  await prisma.telemetry_device_commands.updateMany({
    where: { status: "enviado", enviado_em: { lt: new Date(now.getTime() - COMMAND_ANSWER_TIMEOUT_MS) } },
    data: { status: "falhou", erro: "Rastreador não respondeu ao comando." },
  });
}

export function nextPendingCommand(deviceId) {
  return prisma.telemetry_device_commands.findFirst({
    where: { device_id: Number(deviceId), status: "pendente", expira_em: { gt: new Date() } },
    orderBy: { criado_em: "asc" },
  });
}

export function markCommand(id, data) {
  return prisma.telemetry_device_commands.update({ where: { id: Number(id) }, data });
}
