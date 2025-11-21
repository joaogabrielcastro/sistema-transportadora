// backend/src/controllers/statusPneusController.js
import { statusPneusModel } from '../models/statusPneusModel.js';

export const statusPneusController = {
  getAllStatus: async (req, res) => {
    try {
      const status = await statusPneusModel.getAll();
      res.status(200).json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};