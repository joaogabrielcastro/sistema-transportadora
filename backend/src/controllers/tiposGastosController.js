// backend/src/controllers/tiposGastosController.js
import { tiposGastosModel } from '../models/tiposGastosModel.js';

export const tiposGastosController = {
  getAllTipos: async (req, res) => {
    try {
      const tipos = await tiposGastosModel.getAll();
      res.status(200).json(tipos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};