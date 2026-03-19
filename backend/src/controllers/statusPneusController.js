// backend/src/controllers/statusPneusController.js
import { statusPneusModel } from "../models/statusPneusModel.js";
import { catchAsync } from "../utils/catchAsync.js";

export const statusPneusController = {
  getAllStatus: catchAsync(async (_req, res) => {
    const status = await statusPneusModel.getAll();
    res.status(200).json({ success: true, data: status });
  }),
};
