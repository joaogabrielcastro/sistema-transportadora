// backend/src/controllers/statusPneusController.js
import { statusPneusModel } from "../models/statusPneusModel.js";

export const statusPneusController = {
  getAllStatus: async (req, res, next) => {
    try {
      const status = await statusPneusModel.getAll();
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  },
};
