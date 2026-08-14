import prisma from "../lib/prisma.js";
import { gastosModel } from "../models/gastosModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  syncKmFromRegistro,
  recalculateKmAtual,
} from "./KmCaminhaoService.js";
import { EstoqueService } from "./NotaFiscalService.js";

const assertCaminhaoPertenceAoTenant = async (tenantId, caminhaoId) => {
  const caminhao = await caminhoesModel.getById(tenantId, caminhaoId);
  if (!caminhao) {
    throw new Error("Caminhão não encontrado");
  }
  return caminhao;
};

export class GastoService {
  static async createWithCaminhaoUpdate(tenantId, gastoData) {
    const {
      produto_id,
      quantidade_estoque,
      ...rest
    } = gastoData;
    const novoKm = rest.km_registro;
    const caminhaoId = rest.caminhao_id;

    if (caminhaoId) {
      await assertCaminhaoPertenceAoTenant(tenantId, caminhaoId);
    }

    const novoGasto = await prisma.$transaction(async (tx) => {
      const createData = {
        ...rest,
        tenant_id: Number(tenantId),
      };
      if (produto_id) {
        createData.produto_id = Number(produto_id);
      }

      const gastoCriado = await tx.gastos.create({
        data: createData,
        include: {
          caminhoes: {
            select: { placa: true },
          },
          tipos_gastos: {
            select: { nome_tipo: true },
          },
        },
      });

      if (produto_id) {
        const qtd =
          quantidade_estoque != null && quantidade_estoque !== ""
            ? Number(quantidade_estoque)
            : 1;
        await EstoqueService.baixarComTx(tx, tenantId, {
          produto_id,
          quantidade: qtd,
          caminhao_id: caminhaoId,
          motivo: `Gasto #${gastoCriado.id}${
            rest.descricao ? ` — ${String(rest.descricao).slice(0, 120)}` : ""
          }`,
        });
      }

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

    const { produto_id, quantidade_estoque, ...rest } = gastoData;
    void produto_id;
    void quantidade_estoque;

    if (rest.caminhao_id) {
      await assertCaminhaoPertenceAoTenant(tenantId, rest.caminhao_id);
    }

    const parsedId = Number(id);
    const caminhaoId = rest.caminhao_id ?? existing.caminhao_id;
    const kmAlterado = rest.km_registro !== undefined;
    const novoKm = kmAlterado ? rest.km_registro : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.gastos.update({
        where: { id: parsedId },
        data: rest,
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
