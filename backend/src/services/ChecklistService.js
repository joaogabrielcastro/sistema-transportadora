import prisma from "../lib/prisma.js";
import { checklistModel } from "../models/checklistModel.js";
import {
  syncKmFromRegistro,
  recalculateKmAtual,
} from "./KmCaminhaoService.js";

export class ChecklistService {
  static async createWithCaminhaoUpdate(checklistData) {
    const kmManutencao = checklistData.km_manutencao;
    const caminhaoId = checklistData.caminhao_id;

    const novoChecklist = await prisma.$transaction(async (tx) => {
      const checklistCriado = await tx.checklist.create({
        data: checklistData,
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

    return checklistModel.getById(novoChecklist.id);
  }

  static async updateWithCaminhaoUpdate(id, checklistData) {
    const existing = await checklistModel.getById(id);
    if (!existing) {
      throw new Error("Item de checklist não encontrado");
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

    return checklistModel.getById(parsedId);
  }

  static async deleteWithKmSync(id) {
    const existing = await checklistModel.getById(id);
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
