// backend/src/controllers/tiposGastosController.js
import { tiposGastosModel } from "../models/tiposGastosModel.js";
import { catchAsync } from "../utils/catchAsync.js";

export const tiposGastosController = {
  getAllTipos: catchAsync(async (_req, res) => {
    const tipos = await tiposGastosModel.getAll();
    res.status(200).json({ success: true, data: tipos });
  }),
};