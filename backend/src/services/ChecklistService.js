import prisma from "../lib/prisma.js";
import { checklistModel } from "../models/checklistModel.js";
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

/** Remove campos de API que não existem na tabela checklist. */
const stripApiOnlyFields = (data) => {
  const {
    nome_item: _nomeItem,
    quantidade_estoque: _qtdEstoque,
    ...rest
  } = data;
  return rest;
};

/**
 * Resolve item_id a partir de texto livre (find-or-create) ou do id informado.
 */
const resolveItemId = async (client, { item_id, nome_item }) => {
  if (nome_item != null && String(nome_item).trim() !== "") {
    const nome = String(nome_item).trim();
    const item = await client.itens_checklist.upsert({
      where: { nome_item: nome },
      create: { nome_item: nome },
      update: {},
      select: { id: true },
    });
    return item.id;
  }
  if (item_id != null && item_id !== "") {
    return Number(item_id);
  }
  return undefined;
};

export class ChecklistService {
  static async createWithCaminhaoUpdate(tenantId, checklistData) {
    const kmManutencao = checklistData.km_manutencao;
    const caminhaoId = checklistData.caminhao_id;
    const produtoId = checklistData.produto_id;
    const quantidadeEstoque = checklistData.quantidade_estoque;

    if (caminhaoId) {
      await assertCaminhaoPertenceAoTenant(tenantId, caminhaoId);
    }

    const novoChecklist = await prisma.$transaction(async (tx) => {
      const itemId = await resolveItemId(tx, checklistData);
      const data = stripApiOnlyFields(checklistData);
      if (itemId !== undefined) {
        data.item_id = itemId;
      }
      if (produtoId) {
        data.produto_id = Number(produtoId);
      }

      const checklistCriado = await tx.checklist.create({
        data: {
          ...data,
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

      if (produtoId) {
        const qtd =
          quantidadeEstoque != null && quantidadeEstoque !== ""
            ? Number(quantidadeEstoque)
            : 1;
        await EstoqueService.baixarComTx(tx, tenantId, {
          produto_id: produtoId,
          quantidade: qtd,
          caminhao_id: caminhaoId,
          motivo: `Manutenção #${checklistCriado.id}`,
        });
      }

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
      const data = stripApiOnlyFields(checklistData);
      const hasNome =
        checklistData.nome_item != null &&
        String(checklistData.nome_item).trim() !== "";
      const hasItemId = checklistData.item_id !== undefined;

      if (hasNome || hasItemId) {
        const itemId = await resolveItemId(tx, checklistData);
        if (itemId !== undefined) {
          data.item_id = itemId;
        }
      }

      // Não altera estoque em edição (evita baixa duplicada).
      delete data.produto_id;

      await tx.checklist.update({
        where: { id: parsedId },
        data,
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
