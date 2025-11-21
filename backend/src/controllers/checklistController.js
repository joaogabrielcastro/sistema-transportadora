// backend/src/controllers/checklistController.js
import { checklistModel } from "../models/checklistModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  checklistSchema,
  checklistUpdateSchema,
} from "../schemas/checklistSchema.js";
import { z } from "zod";

export const checklistController = {
  createChecklist: async (req, res) => {
    try {
      const checklistValidado = checklistSchema.parse(req.body);
      const novoChecklist = await checklistModel.create(checklistValidado);

      // Nova lógica para atualizar o KM do caminhão
      if (checklistValidado.km_manutencao) {
        const caminhaoId = checklistValidado.caminhao_id;
        await caminhoesModel.updateById(caminhaoId, {
          km_atual: checklistValidado.km_manutencao,
        });
      }

      res.status(201).json(novoChecklist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  },

  getAllChecklists: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const { caminhaoId } = req.query;

      const { data, count } = await checklistModel.getAll({
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

  getChecklistById: async (req, res) => {
    try {
      const checklist = await checklistModel.getById(req.params.id);
      if (!checklist) {
        return res
          .status(404)
          .json({ error: "Item de checklist não encontrado." });
      }
      res.status(200).json(checklist);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getChecklistsByCaminhao: async (req, res) => {
    try {
      const { id } = req.params;
      const checklists = await checklistModel.getByCaminhaoId(id);
      res.status(200).json(checklists);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateChecklist: async (req, res) => {
    try {
      const checklistValidado = checklistUpdateSchema.parse(req.body);
      const checklistAtualizado = await checklistModel.update(
        req.params.id,
        checklistValidado
      );
      res.status(200).json(checklistAtualizado);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  },

  deleteChecklist: async (req, res) => {
    try {
      await checklistModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};
