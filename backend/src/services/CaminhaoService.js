import { caminhoesModel } from "../models/caminhoesModel.js";
import { CaminhaoDocumentoService } from "./CaminhaoDocumentoService.js";
import { logger } from "../utils/logger.js";
import { normalizePlaca, samePlaca } from "../utils/placa.js";
import { setKmManual } from "./KmCaminhaoService.js";

const samePlacaLocal = samePlaca;

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
  static async criarCaminhao(tenantId, data) {
    const normalized = normalizeCaminhaoPayload(data);
    logger.info("Iniciando criação de caminhão", {
      placa: normalized.placa,
      tenantId,
    });

    try {
      await this.validateUniqueness(tenantId, normalized);

      const novoCaminhao = await caminhoesModel.create(tenantId, normalized);

      logger.info("Caminhão criado com sucesso", {
        id: novoCaminhao.id,
        placa: novoCaminhao.placa,
        tenantId,
      });

      return novoCaminhao;
    } catch (error) {
      logger.error("Erro ao criar caminhão", error);
      throw error;
    }
  }

  static async buscarTodos({ tenantId, page, limit, filtro, termo }) {
    logger.debug("Buscando caminhões", { tenantId, page, limit, filtro, termo });

    try {
      const resultado = await caminhoesModel.getAll({
        tenantId,
        page,
        limit,
        filtro,
        termo,
      });

      logger.info("Caminhões encontrados", {
        total: resultado.count,
        pagina: page,
        tenantId,
      });

      return resultado;
    } catch (error) {
      logger.error("Erro ao buscar caminhões", error);
      throw error;
    }
  }

  static async buscarPorPlaca(tenantId, placa) {
    logger.debug("Buscando caminhão por placa", { placa, tenantId });

    try {
      const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);

      if (!caminhao) {
        logger.warn("Caminhão não encontrado", { placa, tenantId });
        throw new Error("Caminhão não encontrado");
      }

      return caminhao;
    } catch (error) {
      logger.error("Erro ao buscar caminhão por placa", error);
      throw error;
    }
  }

  static async atualizarCaminhao(tenantId, placa, data) {
    const normalized = normalizeCaminhaoPayload(data);
    logger.info("Atualizando caminhão", { placa, tenantId });

    try {
      const caminhao = await this.buscarPorPlaca(tenantId, placa);
      await this.validateUniqueness(tenantId, normalized, placa);

      const { km_atual, ...rest } = normalized;

      if (km_atual !== undefined) {
        await setKmManual(caminhao.id, km_atual);
      }

      const caminhaoAtualizado =
        Object.keys(rest).length > 0
          ? await caminhoesModel.update(tenantId, placa, rest)
          : await caminhoesModel.getByPlaca(tenantId, placa);

      logger.info("Caminhão atualizado com sucesso", { placa, tenantId });

      return caminhaoAtualizado;
    } catch (error) {
      logger.error("Erro ao atualizar caminhão", error);
      throw error;
    }
  }

  static async atualizarCaminhaoPorId(tenantId, id, data) {
    const normalized = normalizeCaminhaoPayload(data);
    logger.info("Atualizando caminhão por id", { id, tenantId });

    const caminhao = await caminhoesModel.getById(tenantId, id);
    if (!caminhao) {
      throw new Error("Caminhão não encontrado");
    }

    await this.validateUniqueness(tenantId, normalized, caminhao.placa);

    const { km_atual, ...rest } = normalized;

    if (km_atual !== undefined) {
      await setKmManual(caminhao.id, km_atual);
    }

    const caminhaoAtualizado =
      Object.keys(rest).length > 0
        ? await caminhoesModel.updateById(tenantId, id, rest)
        : await caminhoesModel.getById(tenantId, id);

    logger.info("Caminhão atualizado por id com sucesso", {
      id: caminhaoAtualizado.id,
      placa: caminhaoAtualizado.placa,
      tenantId,
    });

    return caminhaoAtualizado;
  }

  static async deletarCaminhao(tenantId, placa) {
    logger.info("Iniciando deleção de caminhão", { placa, tenantId });

    try {
      const dependencias = await this.verificarDependencias(tenantId, placa);

      if (dependencias.total > 0) {
        const erro = new Error(
          "Não é possível excluir o caminhão pois existem registros vinculados. " +
            "Exclua primeiro todos os registros relacionados ou use a opção de exclusão em cascata.",
        );
        erro.code = "DEPENDENCIES_EXIST";
        erro.dependencies = dependencias;
        throw erro;
      }

      const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);
      if (caminhao?.id) {
        await CaminhaoDocumentoService.purgeCaminhao(tenantId, caminhao.id);
      }

      await caminhoesModel.delete(tenantId, placa);

      logger.info("Caminhão deletado com sucesso", { placa, tenantId });
    } catch (error) {
      logger.error("Erro ao deletar caminhão", error);
      throw error;
    }
  }

  static async verificarDependencias(tenantId, placa) {
    logger.debug("Verificando dependências", { placa, tenantId });

    try {
      return await caminhoesModel.checkDependencies(tenantId, placa);
    } catch (error) {
      logger.error("Erro ao verificar dependências", error);
      throw error;
    }
  }

  static async pesquisarCaminhoes(tenantId, termo) {
    logger.debug("Pesquisando caminhões", { termo, tenantId });

    if (!termo || termo.trim().length < 2) {
      throw new Error("O termo de busca deve ter pelo menos 2 caracteres");
    }

    try {
      const resultados = await caminhoesModel.search(tenantId, termo.trim());

      logger.info("Pesquisa realizada", {
        termo: termo.trim(),
        resultados: resultados.length,
        tenantId,
      });

      return resultados;
    } catch (error) {
      logger.error("Erro na pesquisa de caminhões", error);
      throw error;
    }
  }

  static async validateUniqueness(tenantId, data, excludePlaca = null) {
    const {
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    } = data;

    const existentes = await caminhoesModel.checkUniqueness(
      tenantId,
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    );

    const excludeNorm = excludePlaca ? normalizePlaca(excludePlaca) : null;
    const conflitos = excludeNorm
      ? existentes.filter((item) => !samePlacaLocal(item.placa, excludePlaca))
      : existentes;

    if (conflitos.length > 0) {
      const erros = this.buildDuplicateErrors(conflitos, data);
      if (erros.size > 0) {
        throw new Error(Array.from(erros).join("; "));
      }
      const placas = conflitos.map((c) => c.placa).join(", ");
      const err = new Error(
        `Conflito com o(s) caminhão(ões): ${placas}. Ajuste número ou placa de carreta, ou número do cavalo, no outro cadastro antes de vincular aqui.`,
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
      if (numero_carreta_1 != null) {
        if (
          sameInt(item.numero_carreta_1, numero_carreta_1) ||
          sameInt(item.numero_carreta_2, numero_carreta_1)
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_1} já está em uso no caminhão ${item.placa}`,
          );
        }
      }

      if (placa_carreta_1) {
        if (
          samePlaca(item.placa_carreta_1, placa_carreta_1) ||
          samePlaca(item.placa_carreta_2, placa_carreta_1)
        ) {
          erros.add(
            `Placa de carreta ${normalizePlaca(placa_carreta_1)} já está em uso no caminhão ${item.placa}`,
          );
        }
      }

      if (numero_carreta_2 != null) {
        if (
          sameInt(item.numero_carreta_1, numero_carreta_2) ||
          sameInt(item.numero_carreta_2, numero_carreta_2)
        ) {
          erros.add(
            `Número de carreta ${numero_carreta_2} já está em uso no caminhão ${item.placa}`,
          );
        }
      }

      if (placa_carreta_2) {
        if (
          samePlaca(item.placa_carreta_1, placa_carreta_2) ||
          samePlaca(item.placa_carreta_2, placa_carreta_2)
        ) {
          erros.add(
            `Placa de carreta ${normalizePlaca(placa_carreta_2)} já está em uso no caminhão ${item.placa}`,
          );
        }
      }

      if (numero_cavalo != null && sameInt(item.numero_cavalo, numero_cavalo)) {
        erros.add(
          `Número do cavalo ${numero_cavalo} já está em uso no caminhão ${item.placa}`,
        );
      }
    });

    return erros;
  }
}
