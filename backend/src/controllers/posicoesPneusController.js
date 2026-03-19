// backend/src/controllers/posicoesPneusController.js
import { posicoesPneusModel } from "../models/posicoesPneusModel.js";
import { catchAsync } from "../utils/catchAsync.js";

export const posicoesPneusController = {
  getAllPosicoes: catchAsync(async (_req, res) => {
    const posicoes = await posicoesPneusModel.getAll();
    res.status(200).json({ success: true, data: posicoes });
  }),
};
