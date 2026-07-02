import prisma from "../lib/prisma.js";
import { checklistModel } from "../models/checklistModel.js";

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

      if (caminhaoId && kmManutencao) {
        await tx.caminhoes.update({
          where: { id: Number(caminhaoId) },
          data: { km_atual: Number(kmManutencao) },
        });
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
    const novoKm =
      checklistData.km_manutencao !== undefined
        ? checklistData.km_manutencao
        : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.checklist.update({
        where: { id: parsedId },
        data: checklistData,
      });

      if (caminhaoId && novoKm != null && novoKm !== "") {
        await tx.caminhoes.update({
          where: { id: Number(caminhaoId) },
          data: { km_atual: Number(novoKm) },
        });
      }
    });

    return checklistModel.getById(parsedId);
  }
}
