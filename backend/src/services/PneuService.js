import { pneusModel } from "../models/pneusModel.js";
import { syncKmFromRegistro, recalculateKmAtual } from "./KmCaminhaoService.js";
import { logger } from "../utils/logger.js";

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
  static async createPneu(data, options = {}) {
    const { stock_pneu_id, consume_from_stock } = options;
    let novoPneu;

    // Cenário 1: Atribuir pneu já existente no estoque
    if (stock_pneu_id) {
      novoPneu = await pneusModel.assignFromStock(stock_pneu_id, data);
    }
    // Cenário 2: Tentar consumir do estoque inteligente
    else if (consume_from_stock) {
      const assigned = await pneusModel.findAndAssignStock(
        { marca: data.marca, modelo: data.modelo },
        data,
      );
      novoPneu = assigned || (await pneusModel.create(data));
    }
    // Cenário 3: Criação padrão
    else {
      novoPneu = await pneusModel.create(data);
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

  static async createBulkPneus(pneusData) {
    if (!pneusData.length) return [];

    const novosPneus = await pneusModel.createBulk(pneusData);

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

  static async createStockPneu(data) {
    const payload = {
      ...data,
      caminhao_id: null,
      posicao_id: data.posicao_id ?? null,
    };
    return await pneusModel.create(payload);
  }

  static async createBulkStockPneus(pneusData) {
    const payload = pneusData.map((p) => ({
      ...p,
      caminhao_id: null,
      posicao_id: p.posicao_id ?? null,
    }));
    return await pneusModel.createBulk(payload);
  }

  static async updatePneu(id, data) {
    const existing = await pneusModel.getById(id);
    if (!existing) {
      throw new Error("Pneu não encontrado");
    }

    const pneuAtualizado = await pneusModel.update(id, data);

    const caminhaoId =
      pneuAtualizado?.caminhao_id ??
      (await pneusModel.getById(id))?.caminhao_id;

    if (caminhaoId && data.km_instalacao !== undefined) {
      if (data.km_instalacao != null && data.km_instalacao !== "") {
        await this.atualizarKmCaminhao(caminhaoId, data.km_instalacao);
      } else {
        await recalculateKmAtual(caminhaoId);
      }
    }

    return pneuAtualizado;
  }

  static async deletePneu(id) {
    const existing = await pneusModel.getById(id);
    if (!existing) {
      throw new Error("Pneu não encontrado");
    }

    const caminhaoId = existing.caminhao_id;
    await pneusModel.delete(id);

    if (caminhaoId) {
      await recalculateKmAtual(caminhaoId);
    }
  }

  static async delete(id) {
    return this.deletePneu(id);
  }

  static async getAll(params = {}) {
    const { limit } = params;
    if (params?.caminhaoId) {
      return await pneusModel.getByCaminhaoId(params.caminhaoId, { limit });
    }
    return await pneusModel.getAll({ limit });
  }

  static async listPaginated(options = {}) {
    return pneusModel.listPaginated(options);
  }

  static buildPagination(page, limit, count) {
    return {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      totalItems: count,
      itemsPerPage: limit,
    };
  }

  static async getInStock(options = {}) {
    return await pneusModel.getInStock(options);
  }

  static async getById(id) {
    return await pneusModel.getById(id);
  }
}
