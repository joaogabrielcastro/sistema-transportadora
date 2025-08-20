// backend/src/controllers/checklistController.js
import { checklistModel } from "../models/checklistModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";

export const checklistController = {
  createChecklist: async (req, res) => {
    try {
      const novoChecklist = await checklistModel.create(req.body);

      // Nova lógica para atualizar o KM do caminhão
      if (req.body.km_registro) {
        const caminhaoId = req.body.caminhao_id;
        const novoKm = req.body.km_registro;
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }

      res.status(201).json(novoChecklist);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  getAllChecklists: async (req, res) => {
    try {
      const checklists = await checklistModel.getAll();
      res.status(200).json(checklists);
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

  getChecklistsByCaminhaoId: async (req, res) => {
    try {
      const checklists = await checklistModel.getByCaminhaoId(
        req.params.caminhaoId
      );
      res.status(200).json(checklists);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateChecklist: async (req, res) => {
    try {
      const checklistAtualizado = await checklistModel.update(
        req.params.id,
        req.body
      );
      res.status(200).json(checklistAtualizado);
    } catch (error) {
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
