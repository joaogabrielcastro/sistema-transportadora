import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import {
  fiscalVeiculoDadosSchema,
  fiscalVeiculoDadosUpdateSchema,
} from "../../schemas/fiscalSchema.js";
import { assertTenantFk } from "./fiscalShared.js";

/**
 * Extensão fiscal de um caminhão (RNTRC do veículo + dados do grupo veicReboque
 * do MDF-e), SEM tocar a tabela caminhoes. 1 registro por caminhão
 * (caminhao_id @unique). O caminhão é revalidado no tenant antes de qualquer
 * escrita.
 *
 * Ainda não há tela para esses campos: o cadastro/edição é só via esta API
 * (POST/PUT /api/fiscal/veiculo-dados).
 */

/** Campos do grupo veicReboque; `undefined` = não mexer, `null`/valor = gravar. */
const REBOQUE_FIELDS = [
  "renavam",
  "tara_kg",
  "cap_kg",
  "cap_m3",
  "tipo_carroceria",
  "uf",
];

function pickReboqueCreate(data) {
  const out = {};
  for (const f of REBOQUE_FIELDS) {
    out[f] = data[f] === undefined || data[f] === "" ? null : data[f];
  }
  return out;
}

function pickReboqueUpdate(data) {
  const out = {};
  for (const f of REBOQUE_FIELDS) {
    if (data[f] !== undefined) out[f] = data[f] === "" ? null : data[f];
  }
  return out;
}
export class FiscalVeiculoDadosService {
  static async list(tenantId) {
    // Só os dados fiscais de veículos cujo caminhão é do tenant.
    const caminhoes = await prisma.caminhoes.findMany({
      where: { tenant_id: Number(tenantId) },
      select: { id: true },
    });
    const ids = caminhoes.map((c) => c.id);
    if (ids.length === 0) return [];
    const rows = await prisma.fiscal_veiculo_dados.findMany({
      where: { caminhao_id: { in: ids } },
      orderBy: { caminhao_id: "asc" },
    });
    return serializePrisma(rows);
  }

  static async getByCaminhao(tenantId, caminhaoId) {
    const id = await assertTenantFk(
      "caminhoes",
      caminhaoId,
      tenantId,
      "Caminhão",
    );
    const row = await prisma.fiscal_veiculo_dados.findUnique({
      where: { caminhao_id: id },
    });
    if (!row) {
      const err = new Error("Dados fiscais do veículo não encontrados");
      err.statusCode = 404;
      throw err;
    }
    return serializePrisma(row);
  }

  /** Cria ou atualiza (idempotente por caminhao_id). */
  static async upsert(tenantId, body) {
    const data = fiscalVeiculoDadosSchema.parse(body);
    const caminhaoId = await assertTenantFk(
      "caminhoes",
      data.caminhao_id,
      tenantId,
      "Caminhão",
    );
    const row = await prisma.fiscal_veiculo_dados.upsert({
      where: { caminhao_id: caminhaoId },
      create: {
        caminhao_id: caminhaoId,
        rntrc_veiculo: data.rntrc_veiculo || null,
        ...pickReboqueCreate(data),
      },
      update: {
        rntrc_veiculo: data.rntrc_veiculo || null,
        ...pickReboqueCreate(data),
      },
    });
    return serializePrisma(row);
  }

  static async update(tenantId, caminhaoId, body) {
    const id = await assertTenantFk(
      "caminhoes",
      caminhaoId,
      tenantId,
      "Caminhão",
    );
    const data = fiscalVeiculoDadosUpdateSchema.parse(body);
    const row = await prisma.fiscal_veiculo_dados.upsert({
      where: { caminhao_id: id },
      create: {
        caminhao_id: id,
        rntrc_veiculo: data.rntrc_veiculo || null,
        ...pickReboqueCreate(data),
      },
      update: {
        ...(data.rntrc_veiculo !== undefined
          ? { rntrc_veiculo: data.rntrc_veiculo || null }
          : {}),
        ...pickReboqueUpdate(data),
      },
    });
    return serializePrisma(row);
  }

  static async remove(tenantId, caminhaoId) {
    const id = await assertTenantFk(
      "caminhoes",
      caminhaoId,
      tenantId,
      "Caminhão",
    );
    await prisma.fiscal_veiculo_dados
      .delete({ where: { caminhao_id: id } })
      .catch(() => {});
    return { deleted: true };
  }
}
