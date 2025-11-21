// backend/src/services/CaminhaoService.js
import { caminhoesModel } from "../models/caminhoesModel.js";
import { logger } from "../utils/logger.js";

export class CaminhaoService {
  static async criarCaminhao(data) {
    logger.info("Iniciando criação de caminhão", { placa: data.placa });

    try {
      // Validar duplicatas
      await this.validateUniqueness(data);

      // Criar caminhão
      const novoCaminhao = await caminhoesModel.create(data);

      logger.info("Caminhão criado com sucesso", {
        id: novoCaminhao.id,
        placa: novoCaminhao.placa,
      });

      return novoCaminhao;
    } catch (error) {
      logger.error("Erro ao criar caminhão", error);
      throw error;
    }
  }

  static async buscarTodos({ page, limit, filtro, termo }) {
    logger.debug("Buscando caminhões", { page, limit, filtro, termo });

    try {
      const resultado = await caminhoesModel.getAll({
        page,
        limit,
        filtro,
        termo,
      });

      logger.info("Caminhões encontrados", {
        total: resultado.count,
        pagina: page,
      });

      return resultado;
    } catch (error) {
      logger.error("Erro ao buscar caminhões", error);
      throw error;
    }
  }

  static async buscarPorPlaca(placa) {
    logger.debug("Buscando caminhão por placa", { placa });

    try {
      const caminhao = await caminhoesModel.getByPlaca(placa);

      if (!caminhao) {
        logger.warn("Caminhão não encontrado", { placa });
        throw new Error("Caminhão não encontrado");
      }

      return caminhao;
    } catch (error) {
      logger.error("Erro ao buscar caminhão por placa", error);
      throw error;
    }
  }

  static async atualizarCaminhao(placa, data) {
    logger.info("Atualizando caminhão", { placa });

    try {
      // Validar existência
      await this.buscarPorPlaca(placa);

      // Validar duplicatas (excluindo o próprio caminhão)
      await this.validateUniqueness(data, placa);

      const caminhaoAtualizado = await caminhoesModel.update(placa, data);

      logger.info("Caminhão atualizado com sucesso", { placa });

      return caminhaoAtualizado;
    } catch (error) {
      logger.error("Erro ao atualizar caminhão", error);
      throw error;
    }
  }

  static async deletarCaminhao(placa) {
    logger.info("Iniciando deleção de caminhão", { placa });

    try {
      // Verificar dependências
      const dependencias = await this.verificarDependencias(placa);

      if (dependencias.total > 0) {
        const erro = new Error(
          "Não é possível excluir o caminhão pois existem registros vinculados. " +
            "Exclua primeiro todos os registros relacionados ou use a opção de exclusão em cascata."
        );
        erro.code = "DEPENDENCIES_EXIST";
        erro.dependencies = dependencias;
        throw erro;
      }

      await caminhoesModel.delete(placa);

      logger.info("Caminhão deletado com sucesso", { placa });
    } catch (error) {
      logger.error("Erro ao deletar caminhão", error);
      throw error;
    }
  }

  static async verificarDependencias(placa) {
    logger.debug("Verificando dependências", { placa });

    try {
      const dependencias = await caminhoesModel.checkDependencies(placa);
      return dependencias;
    } catch (error) {
      logger.error("Erro ao verificar dependências", error);
      throw error;
    }
  }

  static async pesquisarCaminhoes(termo) {
    logger.debug("Pesquisando caminhões", { termo });

    if (!termo || termo.trim().length < 2) {
      throw new Error("O termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const resultados = await caminhoesModel.search(termo.trim());

      logger.info("Pesquisa realizada", {
        termo: termo.trim(),
        resultados: resultados.length,
      });

      return resultados;
    } catch (error) {
      logger.error("Erro na pesquisa de caminhões", error);
      throw error;
    }
  }

  static async validateUniqueness(data, excludePlaca = null) {
    const {
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    } = data;

    const existentes = await caminhoesModel.checkUniqueness(
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo
    );

    // Filtrar o próprio caminhão se estivermos atualizando
    const conflitos = excludePlaca
      ? existentes.filter((item) => item.placa !== excludePlaca)
      : existentes;

    if (conflitos.length > 0) {
      const erros = this.buildDuplicateErrors(conflitos, data);
      if (erros.size > 0) {
        throw new Error(Array.from(erros).join("; "));
      }
    }
  }

  static buildDuplicateErrors(conflitos, data) {
    const erros = new Set();
    const {
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    } = data;

    conflitos.forEach((item) => {
      // Verificações para numero_carreta_1
      if (numero_carreta_1) {
        if (
          item.numero_carreta_1 == numero_carreta_1 ||
          item.numero_carreta_2 == numero_carreta_1
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para placa_carreta_1
      if (placa_carreta_1) {
        if (
          item.placa_carreta_1 == placa_carreta_1 ||
          item.placa_carreta_2 == placa_carreta_1
        ) {
          erros.add(
            `Placa de carreta ${placa_carreta_1} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para numero_carreta_2
      if (numero_carreta_2) {
        if (
          item.numero_carreta_1 == numero_carreta_2 ||
          item.numero_carreta_2 == numero_carreta_2
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para placa_carreta_2
      if (placa_carreta_2) {
        if (
          item.placa_carreta_1 == placa_carreta_2 ||
          item.placa_carreta_2 == placa_carreta_2
        ) {
          erros.add(
            `Placa de carreta ${placa_carreta_2} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificação para numero_cavalo
      if (numero_cavalo && item.numero_cavalo == numero_cavalo) {
        erros.add(
          `Cavalo ${numero_cavalo} já está em uso no caminhão ${item.placa}`
        );
      }
    });

    return erros;
  }
}
