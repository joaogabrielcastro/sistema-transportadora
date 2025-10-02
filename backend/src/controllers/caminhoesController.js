// backend/src/controllers/caminhoesController.js
import { caminhoesModel } from "../models/caminhoesModel.js";

export const caminhoesController = {
  // Criar um caminhão
  createCaminhao: async (req, res) => {
    try {
      const novoCaminhao = await caminhoesModel.create(req.body);
      res.status(201).json(novoCaminhao);
    } catch (error) {
      console.error("Erro ao criar caminhão:", error);
      res.status(400).json({ error: error.message });
    }
  },

  // Listar todos os caminhões
  getAllCaminhoes: async (req, res) => {
    try {
      const caminhoes = await caminhoesModel.getAll();
      res.status(200).json(caminhoes);
    } catch (error) {
      console.error("Erro ao buscar caminhões:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Buscar caminhão por placa
  getByPlaca: async (req, res) => {
    try {
      const caminhao = await caminhoesModel.getByPlaca(req.params.placa);
      if (!caminhao) {
        return res.status(404).json({ message: "Caminhão não encontrado." });
      }
      res.status(200).json(caminhao);
    } catch (error) {
      console.error("ERRO AO BUSCAR CAMINHÃO:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Atualizar caminhão
  updateCaminhao: async (req, res) => {
    try {
      const caminhaoAtualizado = await caminhoesModel.update(
        req.params.placa,
        req.body
      );
      res.status(200).json(caminhaoAtualizado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Verificar dependências antes de excluir
  checkDependencies: async (req, res) => {
    try {
      const { placa } = req.params;
      
      const dependencias = await caminhoesModel.checkDependencies(placa);
      
      res.status(200).json({
        temDependencias: dependencias.total > 0,
        detalhes: dependencias.detalhes,
        total: dependencias.total
      });
    } catch (error) {
      console.error("Erro ao verificar dependências:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Deletar caminhão
  deleteCaminhao: async (req, res) => {
    try {
      await caminhoesModel.delete(req.params.placa);
      res.status(204).send(); // No Content
    } catch (error) {
      console.error("Erro ao deletar caminhão:", error);

      // Se o erro é sobre registros vinculados, retornar 409 (Conflict)
      if (error.message.includes("registros vinculados")) {
        return res.status(409).json({
          error: error.message,
          type: "RELATED_RECORDS_EXIST",
          code: "DEPENDENCIES_EXIST",
          message: "Não é possível excluir: existem registros vinculados a este caminhão"
        });
      }

      res.status(500).json({ error: error.message });
    }
  },

  // Deletar caminhão com cascata (remove todos os registros relacionados)
  deleteCaminhaoWithCascade: async (req, res) => {
    try {
      await caminhoesModel.deleteWithCascade(req.params.placa);
      res.status(204).send(); // No Content
    } catch (error) {
      console.error("Erro ao deletar caminhão com cascata:", error);
      res.status(500).json({ error: error.message });
    }
  },

  createCaminhao: async (req, res) => {
    try {
      console.log('🎯 ROTA CREATE CAMINHÃO CHAMADA!');
      console.log('📥 Dados recebidos:', req.body);
      
      const novoCaminhao = await caminhoesModel.create(req.body);
      res.status(201).json(novoCaminhao);
    } catch (error) {
      console.error("❌ Erro ao criar caminhão:", error);
      res.status(400).json({ error: error.message });
    }
  },
  
};

