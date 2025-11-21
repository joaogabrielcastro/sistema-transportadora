import { gastosModel } from "../models/gastosModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { gastoSchema, gastoUpdateSchema } from "../schemas/gastoSchema.js";
import { z } from "zod";

export const gastosController = {
  createGasto: async (req, res) => {
    try {
      const gastoValidado = gastoSchema.parse(req.body);
      const novoGasto = await gastosModel.create(gastoValidado);

      // --- LÓGICA DE ATUALIZAÇÃO DO KM CENTRALIZADA ---
      const novoKm = gastoValidado.km_registro;
      const caminhaoId = gastoValidado.caminhao_id;

      if (caminhaoId && novoKm) {
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }
      // --- FIM DA LÓGICA DE ATUALIZAÇÃO ---

      res.status(201).json(novoGasto);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("ERRO AO CRIAR GASTO:", error);
      res.status(400).json({ error: error.message });
    }
  },

  getAllGastos: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const { caminhaoId } = req.query;

      const { data, count } = await gastosModel.getAll({
        page,
        limit,
        caminhaoId,
      });

      res.status(200).json({
        data,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalItems: count,
      });
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

  getGastosByCaminhao: async (req, res) => {
    try {
      const { id } = req.params;
      const gastos = await gastosModel.getByCaminhaoId(id);
      res.status(200).json(gastos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateGasto: async (req, res) => {
    try {
      const gastoValidado = gastoUpdateSchema.parse(req.body);
      const gastoAtualizado = await gastosModel.update(
        req.params.id,
        gastoValidado
      );
      res.status(200).json(gastoAtualizado);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
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
