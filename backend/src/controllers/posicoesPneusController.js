// backend/src/controllers/posicoesPneusController.js
import { posicoesPneusModel } from '../models/posicoesPneusModel.js';

export const posicoesPneusController = {
  getAllPosicoes: async (req, res) => {
    try {
      const posicoes = await posicoesPneusModel.getAll();
      res.status(200).json(posicoes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};