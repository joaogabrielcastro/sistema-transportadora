import { gastosModel } from "../models/gastosModel.js";
import { gastoSchema, gastoUpdateSchema } from "../schemas/gastoSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { GastoService } from "../services/GastoService.js";

export const gastosController = {
  createGasto: catchAsync(async (req, res) => {
    const gastoValidado = gastoSchema.parse(req.body);
    const novoGasto =
      await GastoService.createWithCaminhaoUpdate(gastoValidado);

    res.status(201).json({
      success: true,
      data: novoGasto,
      message: "Gasto criado com sucesso",
    });
  }),

  getAllGastos: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { caminhaoId } = req.query;

    const { data, count } = await gastosModel.getAll({
      page,
      limit,
      caminhaoId,
    });

    res.status(200).json({
      success: true,
      data,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalItems: count,
        itemsPerPage: limit,
      },
    });
  }),

  getGastoById: catchAsync(async (req, res) => {
    const gasto = await gastosModel.getById(req.params.id);
    if (!gasto) {
      return res
        .status(404)
        .json({ success: false, error: "Gasto não encontrado." });
    }

    res.status(200).json({ success: true, data: gasto });
  }),

  getGastosByCaminhao: catchAsync(async (req, res) => {
    const { id } = req.params;
    const gastos = await gastosModel.getByCaminhaoId(id);
    res.status(200).json({ success: true, data: gastos });
  }),

  updateGasto: catchAsync(async (req, res) => {
    const gastoValidado = gastoUpdateSchema.parse(req.body);
    const gastoAtualizado = await gastosModel.update(
      req.params.id,
      gastoValidado,
    );
    res.status(200).json({
      success: true,
      data: gastoAtualizado,
      message: "Gasto atualizado com sucesso",
    });
  }),

  deleteGasto: catchAsync(async (req, res) => {
    await gastosModel.delete(req.params.id);
    res.status(204).send();
  }),

  getConsumoCombustivel: catchAsync(async (req, res) => {
    const consumoData = await gastosModel.getConsumoCombustivel(req.params.id);
    res.status(200).json({ success: true, data: consumoData });
  }),
};
