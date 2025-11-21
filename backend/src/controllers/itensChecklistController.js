// backend/src/controllers/itensChecklistController.js
import { itensChecklistModel } from '../models/itensChecklistModel.js';

export const itensChecklistController = {
  getAllItens: async (req, res) => {
    try {
      const itens = await itensChecklistModel.getAll();
      res.status(200).json(itens);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};