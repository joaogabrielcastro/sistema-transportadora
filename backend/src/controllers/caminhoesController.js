// backend/src/controllers/caminhoesController.js
import { CaminhaoService } from "../services/CaminhaoService.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  caminhaoSchema,
  caminhaoUpdateSchema,
} from "../schemas/caminhaoSchema.js";
import { z } from "zod";

export const caminhoesController = {
  // Criar um caminhão
  createCaminhao: async (req, res, next) => {
    try {
      console.log("📥 Recebendo dados:", JSON.stringify(req.body, null, 2));
      const caminhaoValidado = caminhaoSchema.parse(req.body);
      console.log(
        "✅ Validação passou:",
        JSON.stringify(caminhaoValidado, null, 2),
      );
      const novoCaminhao =
        await CaminhaoService.criarCaminhao(caminhaoValidado);

      res.status(201).json({
        success: true,
        data: novoCaminhao,
        message: "Caminhão criado com sucesso",
      });
    } catch (error) {
      console.error("❌ Erro no controller:", error);
      next(error);
    }
  },

  // Listar todos os caminhões com paginação e busca
  getAllCaminhoes: async (req, res, next) => {
    try {
      const filtro = req.query.filtro || null;
      const termo = req.query.termo || null;

      // Se nenhum parâmetro de paginação for fornecido, retornar TODOS os caminhões
      let page;
      let limit;
      const pageParam = req.query.page;
      const limitParam = req.query.limit;

      if (pageParam === undefined && limitParam === undefined) {
        page = 1;
        limit = null; // sinaliza sem paginação
      } else {
        page = Math.max(1, parseInt(req.query.page, 10) || 1);
        limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      }

      const resultado = await CaminhaoService.buscarTodos({
        page,
        limit,
        filtro,
        termo,
      });

      // Se não houve paginação, retornar apenas os dados (compatível com chamadas que esperam array)
      if (limit === null) {
        return res.status(200).json({ success: true, data: resultado.data });
      }

      res.status(200).json({
        success: true,
        data: resultado.data,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(resultado.count / limit),
          totalItems: resultado.count,
          itemsPerPage: limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Buscar caminhão por placa
  getByPlaca: async (req, res, next) => {
    try {
      const { placa } = req.params;
      const caminhao = await CaminhaoService.buscarPorPlaca(placa);

      res.status(200).json({
        success: true,
        data: caminhao,
      });
    } catch (error) {
      next(error);
    }
  },

  // Buscar caminhões por placa ou motorista
  searchCaminhoes: async (req, res, next) => {
    try {
      const { term } = req.query;

      if (!term || term.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "O termo de busca deve ter pelo menos 2 caracteres.",
        });
      }

      const caminhoes = await CaminhaoService.pesquisarCaminhoes(term);

      res.status(200).json({
        success: true,
        data: caminhoes,
        total: caminhoes.length,
      });
    } catch (error) {
      next(error);
    }
  },

  // Atualizar caminhão
  updateCaminhao: async (req, res, next) => {
    try {
      const { placa } = req.params;
      const caminhaoValidado = caminhaoUpdateSchema.parse(req.body);

      const caminhaoAtualizado = await CaminhaoService.atualizarCaminhao(
        placa,
        caminhaoValidado,
      );

      res.status(200).json({
        success: true,
        data: caminhaoAtualizado,
        message: "Caminhão atualizado com sucesso",
      });
    } catch (error) {
      next(error);
    }
  },

  // Verificar dependências antes de excluir
  checkDependencies: async (req, res, next) => {
    try {
      const { placa } = req.params;
      const dependencias = await CaminhaoService.verificarDependencias(placa);

      res.status(200).json({
        success: true,
        data: {
          temDependencias: dependencias.total > 0,
          detalhes: dependencias.detalhes,
          total: dependencias.total,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Deletar caminhão
  deleteCaminhao: async (req, res, next) => {
    try {
      const { placa } = req.params;
      await CaminhaoService.deletarCaminhao(placa);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // Deletar caminhão com cascata (remove todos os registros relacionados)
  deleteCaminhaoWithCascade: async (req, res, next) => {
    try {
      const { placa } = req.params;
      await caminhoesModel.deleteWithCascade(placa);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  // Atualizar caminhão por ID (usado pelo frontend quando se tem apenas o id)
  updateCaminhaoById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const caminhaoData = req.body;

      const caminhaoAtualizado = await caminhoesModel.updateById(id, caminhaoData);

      res.status(200).json({ success: true, data: caminhaoAtualizado, message: 'Caminhão atualizado por id com sucesso' });
    } catch (error) {
      next(error);
    }
  },
};
