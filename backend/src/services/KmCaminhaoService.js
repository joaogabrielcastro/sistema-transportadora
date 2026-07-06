import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

/**
 * Regra única de KM do caminhão:
 * - Registros (gasto, manutenção, pneu): só aumentam km_atual, nunca regridem.
 * - Edição manual do caminhão: permite qualquer valor >= 0 (correção).
 * - Exclusão de registro: recalcula km_atual pelo maior KM dos registros restantes.
 */

export function resolveKmUpdate(atual, novoKm, { allowRegression = false } = {}) {
  if (novoKm == null || novoKm === "") {
    return { apply: false, km: null, reason: "empty" };
  }

  const km = Number(novoKm);
  if (!Number.isFinite(km) || km < 0) {
    return { apply: false, km: null, reason: "invalid" };
  }

  const current = Number(atual ?? 0);

  if (!allowRegression && km < current) {
    return { apply: false, km: null, reason: "regression" };
  }

  if (!allowRegression && km === current) {
    return { apply: false, km: null, reason: "unchanged" };
  }

  return { apply: true, km, reason: allowRegression ? "manual" : "registro" };
}

async function persistKm(caminhaoId, km, client) {
  await client.caminhoes.update({
    where: { id: Number(caminhaoId) },
    data: { km_atual: km },
  });
  return true;
}

/**
 * Atualiza km_atual a partir de gasto / manutenção / pneu (sem regressão).
 */
export async function syncKmFromRegistro(caminhaoId, novoKm, { tx = null } = {}) {
  if (!caminhaoId) return false;

  const client = tx || prisma;
  const caminhao = await client.caminhoes.findUnique({
    where: { id: Number(caminhaoId) },
    select: { km_atual: true },
  });

  if (!caminhao) return false;

  const decision = resolveKmUpdate(caminhao.km_atual, novoKm, {
    allowRegression: false,
  });

  if (!decision.apply) {
    if (decision.reason === "regression") {
      logger.debug("KM de registro ignorado (menor que o atual)", {
        caminhaoId,
        novoKm,
        atual: caminhao.km_atual,
      });
    }
    return false;
  }

  await persistKm(caminhaoId, decision.km, client);
  return true;
}

/**
 * Atualização explícita na ficha do caminhão (permite correção para baixo).
 */
export async function setKmManual(caminhaoId, novoKm, { tx = null } = {}) {
  if (!caminhaoId) return false;

  const client = tx || prisma;
  const caminhao = await client.caminhoes.findUnique({
    where: { id: Number(caminhaoId) },
    select: { km_atual: true },
  });

  if (!caminhao) return false;

  const decision = resolveKmUpdate(caminhao.km_atual, novoKm, {
    allowRegression: true,
  });

  if (!decision.apply) return false;

  await persistKm(caminhaoId, decision.km, client);

  if (decision.km < Number(caminhao.km_atual ?? 0)) {
    logger.info("KM do caminhão corrigido manualmente", {
      caminhaoId,
      de: caminhao.km_atual,
      para: decision.km,
    });
  }

  return true;
}

const toKm = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Recalcula km_atual pelo maior KM entre gastos, manutenções e pneus do veículo.
 * Se não houver registros com KM, mantém o valor atual.
 */
export async function recalculateKmAtual(caminhaoId, { tx = null } = {}) {
  if (!caminhaoId) return false;

  const client = tx || prisma;
  const id = Number(caminhaoId);

  const [gastosAgg, checklistAgg, pneusAgg, caminhao] = await Promise.all([
    client.gastos.aggregate({
      where: { caminhao_id: id, km_registro: { not: null } },
      _max: { km_registro: true },
    }),
    client.checklist.aggregate({
      where: { caminhao_id: id, km_manutencao: { not: null } },
      _max: { km_manutencao: true },
    }),
    client.pneus.aggregate({
      where: { caminhao_id: id, km_instalacao: { not: null } },
      _max: { km_instalacao: true },
    }),
    client.caminhoes.findUnique({
      where: { id },
      select: { km_atual: true },
    }),
  ]);

  if (!caminhao) return false;

  const candidatos = [
    toKm(gastosAgg._max.km_registro),
    toKm(checklistAgg._max.km_manutencao),
    toKm(pneusAgg._max.km_instalacao),
  ].filter((km) => km != null);

  if (candidatos.length === 0) {
    return false;
  }

  const novoKm = Math.max(...candidatos);
  const atual = Number(caminhao.km_atual ?? 0);

  if (novoKm === atual) return false;

  await persistKm(id, novoKm, client);
  logger.info("KM do caminhão recalculado após alteração de registros", {
    caminhaoId: id,
    de: atual,
    para: novoKm,
  });
  return true;
}

/** @deprecated use syncKmFromRegistro */
export const atualizarKmCaminhaoSeMaior = syncKmFromRegistro;
