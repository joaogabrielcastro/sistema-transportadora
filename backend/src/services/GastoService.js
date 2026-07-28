import prisma from "../lib/prisma.js";
import { gastosModel } from "../models/gastosModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  syncKmFromRegistro,
  recalculateKmAtual,
} from "./KmCaminhaoService.js";

const assertCaminhaoPertenceAoTenant = async (tenantId, caminhaoId) => {
  const caminhao = await caminhoesModel.getById(tenantId, caminhaoId);
  if (!caminhao) {
    throw new Error("Caminhão não encontrado");
  }
  return caminhao;
};

export class GastoService {
  static async createWithCaminhaoUpdate(tenantId, gastoData) {
    const novoKm = gastoData.km_registro;
    const caminhaoId = gastoData.caminhao_id;

    if (caminhaoId) {
      await assertCaminhaoPertenceAoTenant(tenantId, caminhaoId);
    }

    const novoGasto = await prisma.$transaction(async (tx) => {
      const gastoCriado = await tx.gastos.create({
        data: {
          ...gastoData,
          tenant_id: Number(tenantId),
        },
        include: {
          caminhoes: {
            select: { placa: true },
          },
          tipos_gastos: {
            select: { nome_tipo: true },
          },
        },
      });

      if (caminhaoId && novoKm != null) {
        await syncKmFromRegistro(caminhaoId, novoKm, { tx });
      }

      return gastoCriado;
    });

    return gastosModel.getById(tenantId, novoGasto.id);
  }

  static async updateWithCaminhaoUpdate(tenantId, id, gastoData) {
    const existing = await gastosModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Gasto não encontrado");
    }

    if (gastoData.caminhao_id) {
      await assertCaminhaoPertenceAoTenant(tenantId, gastoData.caminhao_id);
    }

    const parsedId = Number(id);
    const caminhaoId = gastoData.caminhao_id ?? existing.caminhao_id;
    const kmAlterado = gastoData.km_registro !== undefined;
    const novoKm = kmAlterado ? gastoData.km_registro : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.gastos.update({
        where: { id: parsedId },
        data: gastoData,
      });

      if (!caminhaoId) return;

      if (kmAlterado && novoKm != null && novoKm !== "") {
        await syncKmFromRegistro(caminhaoId, novoKm, { tx });
      } else if (kmAlterado) {
        await recalculateKmAtual(caminhaoId, { tx });
      }
    });

    return gastosModel.getById(tenantId, parsedId);
  }

  static async deleteWithKmSync(tenantId, id) {
    const existing = await gastosModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Gasto não encontrado");
    }

    const caminhaoId = existing.caminhao_id;

    await prisma.$transaction(async (tx) => {
      await tx.gastos.delete({ where: { id: Number(id) } });
      if (caminhaoId) {
        await recalculateKmAtual(caminhaoId, { tx });
      }
    });
  }
}
