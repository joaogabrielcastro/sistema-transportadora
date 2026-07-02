// backend/src/controllers/checklistController.js
import { checklistModel } from "../models/checklistModel.js";
import {
  checklistSchema,
  checklistUpdateSchema,
} from "../schemas/checklistSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { ChecklistService } from "../services/ChecklistService.js";
import { normalizeDatesForDb } from "../utils/dates.js";
import { parseListLimit } from "../utils/listLimits.js";

export const checklistController = {
  createChecklist: catchAsync(async (req, res) => {
    const checklistValidado = checklistSchema.parse(req.body);
    const novoChecklist =
      await ChecklistService.createWithCaminhaoUpdate(
        normalizeDatesForDb(checklistValidado),
      );
    res.status(201).json({
      success: true,
      data: novoChecklist,
      message: "Checklist criado com sucesso",
    });
  }),

  getAllChecklists: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseListLimit(req.query.limit, 10);
    const { caminhaoId } = req.query;

    const { data, count } = await checklistModel.getAll({
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

  getChecklistById: catchAsync(async (req, res) => {
    const checklist = await checklistModel.getById(req.params.id);
    if (!checklist) {
      return res
        .status(404)
        .json({ success: false, error: "Item de checklist não encontrado." });
    }

    res.status(200).json({ success: true, data: checklist });
  }),

  getChecklistsByCaminhao: catchAsync(async (req, res) => {
    const { id } = req.params;
    const limit = parseListLimit(req.query.limit);
    const result = await checklistModel.getByCaminhaoId(id, { limit });
    res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        limit: result.limit,
        truncated: result.truncated,
      },
    });
  }),

  updateChecklist: catchAsync(async (req, res) => {
    const checklistValidado = checklistUpdateSchema.parse(req.body);
    const checklistAtualizado = await ChecklistService.updateWithCaminhaoUpdate(
      req.params.id,
      normalizeDatesForDb(checklistValidado),
    );
    res.status(200).json({
      success: true,
      data: checklistAtualizado,
      message: "Checklist atualizado com sucesso",
    });
  }),

  deleteChecklist: catchAsync(async (req, res) => {
    await checklistModel.delete(req.params.id);
    res.status(204).send();
  }),
};
