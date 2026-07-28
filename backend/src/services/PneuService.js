import { pneusModel } from "../models/pneusModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { syncKmFromRegistro, recalculateKmAtual } from "./KmCaminhaoService.js";
import { logger } from "../utils/logger.js";

const assertCaminhaoPertenceAoTenant = async (tenantId, caminhaoId) => {
  const caminhao = await caminhoesModel.getById(tenantId, caminhaoId);
  if (!caminhao) {
    throw new Error("Caminhão não encontrado");
  }
  return caminhao;
};

export class PneuService {
  /**
   * Atualiza o KM do caminhão se necessário
   */
  static async atualizarKmCaminhao(caminhaoId, kmInstalacao) {
    if (!caminhaoId || !kmInstalacao) return;

    try {
      const updated = await syncKmFromRegistro(caminhaoId, kmInstalacao);
      if (updated) {
        logger.info(
          `KM do caminhão ${caminhaoId} atualizado para ${kmInstalacao}`,
        );
      }
    } catch (error) {
      logger.error(`Erro ao atualizar KM do caminhão ${caminhaoId}`, error);
    }
  }

  /**
   * Cria um pneu, lidando com lógica de estoque e atribuição
   */
  static async createPneu(tenantId, data, options = {}) {
    const { stock_pneu_id, consume_from_stock } = options;

    if (data.caminhao_id) {
      await assertCaminhaoPertenceAoTenant(tenantId, data.caminhao_id);
    }

    let novoPneu;

    // Cenário 1: Atribuir pneu já existente no estoque
    if (stock_pneu_id) {
      novoPneu = await pneusModel.assignFromStock(tenantId, stock_pneu_id, data);
    }
    // Cenário 2: Tentar consumir do estoque inteligente
    else if (consume_from_stock) {
      const assigned = await pneusModel.findAndAssignStock(
        tenantId,
        { marca: data.marca, modelo: data.modelo },
        data,
      );
      novoPneu = assigned || (await pneusModel.create(tenantId, data));
    }
    // Cenário 3: Criação padrão
    else {
      novoPneu = await pneusModel.create(tenantId, data);
    }

    // Side-effect: Atualizar KM
    if (novoPneu?.caminhao_id && novoPneu?.km_instalacao) {
      await this.atualizarKmCaminhao(
        novoPneu.caminhao_id,
        novoPneu.km_instalacao,
      );
    }

    return novoPneu;
  }

  static async createBulkPneus(tenantId, pneusData) {
    if (!pneusData.length) return [];

    const caminhaoIds = [
      ...new Set(pneusData.map((p) => p.caminhao_id).filter(Boolean)),
    ];
    for (const caminhaoId of caminhaoIds) {
      await assertCaminhaoPertenceAoTenant(tenantId, caminhaoId);
    }

    const novosPneus = await pneusModel.createBulk(tenantId, pneusData);

    // Lógica para atualizar o KM com o maior do lote
    // Assume que o lote é pro mesmo caminhão
    const caminhaoId = pneusData.find((p) => p.caminhao_id)?.caminhao_id;
    if (caminhaoId) {
      const maxKm = Math.max(...pneusData.map((p) => p.km_instalacao || 0));
      if (maxKm > 0) {
        await this.atualizarKmCaminhao(caminhaoId, maxKm);
      }
    }

    return novosPneus;
  }

  static async createStockPneu(tenantId, data) {
    const payload = {
      ...data,
      caminhao_id: null,
      posicao_id: data.posicao_id ?? null,
    };
    return await pneusModel.create(tenantId, payload);
  }

  static async createBulkStockPneus(tenantId, pneusData) {
    const payload = pneusData.map((p) => ({
      ...p,
      caminhao_id: null,
      posicao_id: p.posicao_id ?? null,
    }));
    return await pneusModel.createBulk(tenantId, payload);
  }

  static async updatePneu(tenantId, id, data) {
    const existing = await pneusModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Pneu não encontrado");
    }

    if (data.caminhao_id) {
      await assertCaminhaoPertenceAoTenant(tenantId, data.caminhao_id);
    }

    const pneuAtualizado = await pneusModel.update(tenantId, id, data);

    const caminhaoId =
      pneuAtualizado?.caminhao_id ??
      (await pneusModel.getById(tenantId, id))?.caminhao_id;

    if (caminhaoId && data.km_instalacao !== undefined) {
      if (data.km_instalacao != null && data.km_instalacao !== "") {
        await this.atualizarKmCaminhao(caminhaoId, data.km_instalacao);
      } else {
        await recalculateKmAtual(caminhaoId);
      }
    }

    return pneuAtualizado;
  }

  static async deletePneu(tenantId, id) {
    const existing = await pneusModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Pneu não encontrado");
    }

    const caminhaoId = existing.caminhao_id;
    await pneusModel.delete(tenantId, id);

    if (caminhaoId) {
      await recalculateKmAtual(caminhaoId);
    }
  }

  static async delete(tenantId, id) {
    return this.deletePneu(tenantId, id);
  }

  static async getAll(tenantId, params = {}) {
    const { limit } = params;
    if (params?.caminhaoId) {
      return await pneusModel.getByCaminhaoId(tenantId, params.caminhaoId, { limit });
    }
    return await pneusModel.getAll(tenantId, { limit });
  }

  static async listPaginated(tenantId, options = {}) {
    return pneusModel.listPaginated(tenantId, options);
  }

  static buildPagination(page, limit, count) {
    return {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
      itemsPerPage: limit,
    };
  }

  static async getInStock(tenantId, options = {}) {
    return await pneusModel.getInStock(tenantId, options);
  }

  static async getById(tenantId, id) {
    return await pneusModel.getById(tenantId, id);
  }
}
