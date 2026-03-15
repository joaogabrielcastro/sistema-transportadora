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
}
