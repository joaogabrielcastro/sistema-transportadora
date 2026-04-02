// backend/src/services/CaminhaoService.js
import { caminhoesModel } from "../models/caminhoesModel.js";
import { logger } from "../utils/logger.js";

const normalizePlaca = (value) => {
  if (value == null || value === "") return null;
  const s = String(value).trim().toUpperCase().replace(/-/g, "");
  return s || null;
};

const samePlaca = (a, b) => {
  const na = normalizePlaca(a);
  const nb = normalizePlaca(b);
  if (!na || !nb) return false;
  return na === nb;
};

/** Inteiro opcional (null se vazio); preserva 0 quando informado. */
const normalizeOptionalInt = (value) => {
  if (value === undefined) return undefined;
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const sameInt = (a, b) => {
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
};

const normalizeCaminhaoPayload = (data) => {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if ("placa_carreta_1" in out) {
    out.placa_carreta_1 = normalizePlaca(out.placa_carreta_1);
  }
  if ("placa_carreta_2" in out) {
    out.placa_carreta_2 = normalizePlaca(out.placa_carreta_2);
  }
  if ("placa" in out) {
    out.placa = normalizePlaca(out.placa);
  }
  for (const key of ["numero_carreta_1", "numero_carreta_2", "numero_cavalo"]) {
    if (key in out) {
      out[key] = normalizeOptionalInt(out[key]);
    }
  }
  return out;
};

export class CaminhaoService {
  static async criarCaminhao(data) {
    const normalized = normalizeCaminhaoPayload(data);
    logger.info("Iniciando criação de caminhão", { placa: normalized.placa });

    try {
      // Validar duplicatas
      await this.validateUniqueness(normalized);

      // Criar caminhão
      const novoCaminhao = await caminhoesModel.create(normalized);

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
    const normalized = normalizeCaminhaoPayload(data);
    logger.info("Atualizando caminhão", { placa });

    try {
      // Validar existência
      await this.buscarPorPlaca(placa);

      // Validar duplicatas (excluindo o próprio caminhão)
      await this.validateUniqueness(normalized, placa);

      const caminhaoAtualizado = await caminhoesModel.update(placa, normalized);

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

    // Filtrar o próprio caminhão se estivermos atualizando (placa case-insensitive)
    const excludeNorm = excludePlaca ? normalizePlaca(excludePlaca) : null;
    const conflitos = excludeNorm
      ? existentes.filter((item) => normalizePlaca(item.placa) !== excludeNorm)
      : existentes;

    if (conflitos.length > 0) {
      const erros = this.buildDuplicateErrors(conflitos, data);
      if (erros.size > 0) {
        throw new Error(Array.from(erros).join("; "));
      }
      const placas = conflitos.map((c) => c.placa).join(", ");
      const err = new Error(
        `Conflito com o(s) caminhão(ões): ${placas}. Ajuste número ou placa de carreta, ou número do cavalo, no outro cadastro antes de vincular aqui.`
      );
      err.code = "DUPLICATE_CAMINHAO_FIELDS";
      err.conflicts = conflitos.map((c) => ({ placa: c.placa }));
      throw err;
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
      if (numero_carreta_1 != null) {
        if (
          sameInt(item.numero_carreta_1, numero_carreta_1) ||
          sameInt(item.numero_carreta_2, numero_carreta_1)
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para placa_carreta_1
      if (placa_carreta_1) {
        if (
          samePlaca(item.placa_carreta_1, placa_carreta_1) ||
          samePlaca(item.placa_carreta_2, placa_carreta_1)
        ) {
          erros.add(
            `Placa de carreta ${normalizePlaca(placa_carreta_1)} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para numero_carreta_2
      if (numero_carreta_2 != null) {
        if (
          sameInt(item.numero_carreta_1, numero_carreta_2) ||
          sameInt(item.numero_carreta_2, numero_carreta_2)
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificações para placa_carreta_2
      if (placa_carreta_2) {
        if (
          samePlaca(item.placa_carreta_1, placa_carreta_2) ||
          samePlaca(item.placa_carreta_2, placa_carreta_2)
        ) {
          erros.add(
            `Placa de carreta ${normalizePlaca(placa_carreta_2)} já está em uso no caminhão ${item.placa}`
          );
        }
      }

      // Verificação para número do cavalo (mesmo padrão das carretas: mostra o outro caminhão)
      if (numero_cavalo != null && sameInt(item.numero_cavalo, numero_cavalo)) {
        erros.add(
          `Número do cavalo ${numero_cavalo} já está em uso no caminhão ${item.placa}`
        );
      }
    });

    return erros;
  }
}
