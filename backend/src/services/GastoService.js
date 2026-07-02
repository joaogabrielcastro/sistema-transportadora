import prisma from "../lib/prisma.js";
import { gastosModel } from "../models/gastosModel.js";

export class GastoService {
  static async createWithCaminhaoUpdate(gastoData) {
    const novoKm = gastoData.km_registro;
    const caminhaoId = gastoData.caminhao_id;

    const novoGasto = await prisma.$transaction(async (tx) => {
      const gastoCriado = await tx.gastos.create({
        data: gastoData,
        include: {
          caminhoes: {
            select: { placa: true },
          },
          tipos_gastos: {
            select: { nome_tipo: true },
          },
        },
      });

      if (caminhaoId && novoKm) {
        await tx.caminhoes.update({
          where: { id: Number(caminhaoId) },
          data: { km_atual: Number(novoKm) },
        });
      }

      return gastoCriado;
    });

    return gastosModel.getById(novoGasto.id);
  }

  static async updateWithCaminhaoUpdate(id, gastoData) {
    const existing = await gastosModel.getById(id);
    if (!existing) {
      throw new Error("Gasto não encontrado");
    }

    const parsedId = Number(id);
    const caminhaoId = gastoData.caminhao_id ?? existing.caminhao_id;
    const novoKm =
      gastoData.km_registro !== undefined
        ? gastoData.km_registro
        : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.gastos.update({
        where: { id: parsedId },
        data: gastoData,
      });

      if (caminhaoId && novoKm != null && novoKm !== "") {
        await tx.caminhoes.update({
          where: { id: Number(caminhaoId) },
          data: { km_atual: Number(novoKm) },
        });
      }
    });

    return gastosModel.getById(parsedId);
  }
}
