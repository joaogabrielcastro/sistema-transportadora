// backend/src/controllers/checklistController.js
import { checklistModel } from "../models/checklistModel.js";
import {
  checklistSchema,
  checklistUpdateSchema,
} from "../schemas/checklistSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { ChecklistService } from "../services/ChecklistService.js";

export const checklistController = {
  createChecklist: catchAsync(async (req, res) => {
    const checklistValidado = checklistSchema.parse(req.body);
    const novoChecklist =
      await ChecklistService.createWithCaminhaoUpdate(checklistValidado);

    res.status(201).json({
      success: true,
      data: novoChecklist,
      message: "Checklist criado com sucesso",
    });
  }),

  getAllChecklists: catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
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
    const checklists = await checklistModel.getByCaminhaoId(id);
    res.status(200).json({ success: true, data: checklists });
  }),

  updateChecklist: catchAsync(async (req, res) => {
    const checklistValidado = checklistUpdateSchema.parse(req.body);
    const checklistAtualizado = await checklistModel.update(
      req.params.id,
      checklistValidado,
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
