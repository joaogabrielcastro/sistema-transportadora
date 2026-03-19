// backend/src/controllers/itensChecklistController.js
import { itensChecklistModel } from "../models/itensChecklistModel.js";
import { catchAsync } from "../utils/catchAsync.js";

export const itensChecklistController = {
  getAllItens: catchAsync(async (_req, res) => {
    const itens = await itensChecklistModel.getAll();
    res.status(200).json({ success: true, data: itens });
  }),
};