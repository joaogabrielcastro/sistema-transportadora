// backend/src/controllers/gastosController.js
import { gastosModel } from "../models/gastosModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";

export const gastosController = {
  createGasto: async (req, res) => {
    try {
      const novoGasto = await gastosModel.create(req.body);

      const ID_TIPO_GASTO_COMBUSTIVEL = 1;
      if (req.body.tipo_gasto_id === ID_TIPO_GASTO_COMBUSTIVEL && req.body.km_registro) {
        // Agora chamamos a nova função que usa o ID
        const caminhaoId = req.body.caminhao_id;
        const novoKm = req.body.km_registro;
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }

      res.status(201).json(novoGasto);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  getAllGastos: async (req, res) => {
    try {
      const gastos = await gastosModel.getAll();
      res.status(200).json(gastos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getGastoById: async (req, res) => {
    try {
      const gasto = await gastosModel.getById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ error: "Gasto não encontrado." });
      }
      res.status(200).json(gasto);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getGastosByCaminhaoId: async (req, res) => {
    try {
      const gastos = await gastosModel.getByCaminhaoId(req.params.caminhaoId);
      res.status(200).json(gastos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateGasto: async (req, res) => {
    try {
      const gastoAtualizado = await gastosModel.update(req.params.id, req.body);
      res.status(200).json(gastoAtualizado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  deleteGasto: async (req, res) => {
    try {
      await gastosModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getConsumoCombustivel: async (req, res) => {
    try {
      const consumoData = await gastosModel.getConsumoCombustivel(
        req.params.id
      );
      res.status(200).json(consumoData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};
