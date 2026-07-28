import prisma from "../lib/prisma.js";
import { checklistModel } from "../models/checklistModel.js";
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

export class ChecklistService {
  static async createWithCaminhaoUpdate(tenantId, checklistData) {
    const kmManutencao = checklistData.km_manutencao;
    const caminhaoId = checklistData.caminhao_id;

    if (caminhaoId) {
      await assertCaminhaoPertenceAoTenant(tenantId, caminhaoId);
    }

    const novoChecklist = await prisma.$transaction(async (tx) => {
      const checklistCriado = await tx.checklist.create({
        data: {
          ...checklistData,
          tenant_id: Number(tenantId),
        },
        include: {
          caminhoes: {
            select: { placa: true },
          },
          itens_checklist: {
            select: { nome_item: true },
          },
        },
      });

      if (caminhaoId && kmManutencao != null) {
        await syncKmFromRegistro(caminhaoId, kmManutencao, { tx });
      }

      return checklistCriado;
    });

    return checklistModel.getById(tenantId, novoChecklist.id);
  }

  static async updateWithCaminhaoUpdate(tenantId, id, checklistData) {
    const existing = await checklistModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Item de checklist não encontrado");
    }

    if (checklistData.caminhao_id) {
      await assertCaminhaoPertenceAoTenant(tenantId, checklistData.caminhao_id);
    }

    const parsedId = Number(id);
    const caminhaoId = checklistData.caminhao_id ?? existing.caminhao_id;
    const kmAlterado = checklistData.km_manutencao !== undefined;
    const novoKm = kmAlterado ? checklistData.km_manutencao : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.checklist.update({
        where: { id: parsedId },
        data: checklistData,
      });

      if (!caminhaoId) return;

      if (kmAlterado && novoKm != null && novoKm !== "") {
        await syncKmFromRegistro(caminhaoId, novoKm, { tx });
      } else if (kmAlterado) {
        await recalculateKmAtual(caminhaoId, { tx });
      }
    });

    return checklistModel.getById(tenantId, parsedId);
  }

  static async deleteWithKmSync(tenantId, id) {
    const existing = await checklistModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Item de checklist não encontrado");
    }

    const caminhaoId = existing.caminhao_id;

    await prisma.$transaction(async (tx) => {
      await tx.checklist.delete({ where: { id: Number(id) } });
      if (caminhaoId) {
        await recalculateKmAtual(caminhaoId, { tx });
      }
    });
  }
}
