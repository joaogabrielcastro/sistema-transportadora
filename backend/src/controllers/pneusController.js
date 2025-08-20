// backend/src/controllers/pneusController.js
import { pneusModel } from "../models/pneusModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";

export const pneusController = {
  createPneu: async (req, res) => {
    try {
      const novoPneu = await pneusModel.create(req.body);

      // Nova lógica para atualizar o KM do caminhão
      if (req.body.km_instalacao) {
        const caminhaoId = req.body.caminhao_id;
        const novoKm = req.body.km_instalacao;
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }

      res.status(201).json(novoPneu);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  getAllPneus: async (req, res) => {
    try {
      const pneus = await pneusModel.getAll();
      res.status(200).json(pneus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPneuById: async (req, res) => {
    try {
      const pneu = await pneusModel.getById(req.params.id);
      if (!pneu) {
        return res.status(404).json({ error: "Pneu não encontrado." });
      }
      res.status(200).json(pneu);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPneusByCaminhaoId: async (req, res) => {
    try {
      const pneus = await pneusModel.getByCaminhaoId(req.params.caminhaoId);
      res.status(200).json(pneus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updatePneu: async (req, res) => {
    try {
      const pneuAtualizado = await pneusModel.update(req.params.id, req.body);
      res.status(200).json(pneuAtualizado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  deletePneu: async (req, res) => {
    try {
      await pneusModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};
