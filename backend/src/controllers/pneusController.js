// backend/src/controllers/pneusController.js
import { PneuService } from "../services/PneuService.js";
import {
  pneuSchema,
  pneuUpdateSchema,
  pneuCreateInStockSchema,
  pneuCreateSchema,
} from "../schemas/pneuSchema.js";
import { z } from "zod";
import { catchAsync } from "../utils/catchAsync.js";
import { normalizeDatesForDb } from "../utils/dates.js";
import { parseListLimit } from "../utils/listLimits.js";

export const pneusController = {
  createPneu: catchAsync(async (req, res) => {
    const body = pneuCreateSchema.parse(req.body);
    const { stock_pneu_id, consume_from_stock, ...dados } = body;
    const payload =
      stock_pneu_id != null ? pneuSchema.partial().parse(dados) : pneuSchema.parse(dados);

    const novoPneu = await PneuService.createPneu(normalizeDatesForDb(payload), {
      stock_pneu_id,
      consume_from_stock,
    });
    res.status(201).json({
      success: true,
      data: novoPneu,
      message: "Pneu criado com sucesso",
    });
  }),

  createBulkPneus: catchAsync(async (req, res) => {
    const { pneus } = z.object({ pneus: z.array(pneuSchema) }).parse(req.body);
    if (pneus.length === 0) {
      return res.status(400).json({
        success: false,
        error: "A lista de pneus não pode estar vazia.",
        code: "VALIDATION_ERROR",
      });
    }
    const novosPneus = await PneuService.createBulkPneus(
      pneus.map(normalizeDatesForDb),
    );
    res.status(201).json({
      success: true,
      data: novosPneus,
      message: "Pneus criados com sucesso",
    });
  }),

  // Listar pneus em estoque
  getInStockPneus: catchAsync(async (req, res) => {
    const pageParam = req.query.page;
    if (pageParam !== undefined) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = parseListLimit(req.query.limit, 20);
      const { data, count, meta } = await PneuService.listPaginated({
        page,
        limit,
        emUso: false,
        includeStockStatusCounts: true,
      });
      return res.status(200).json({
        success: true,
        data,
        meta,
        pagination: PneuService.buildPagination(page, limit, count),
      });
    }

    const limit = parseListLimit(req.query.limit);
    const pneus = await PneuService.getInStock({ limit });
    res.status(200).json({ success: true, data: pneus });
  }),

  // Criar pneus em lote no estoque
  createBulkStockPneus: catchAsync(async (req, res) => {
    const { pneus } = z
      .object({ pneus: z.array(pneuCreateInStockSchema) })
      .parse(req.body);
    if (pneus.length === 0) {
      return res.status(400).json({
        success: false,
        error: "A lista de pneus não pode estar vazia.",
        code: "VALIDATION_ERROR",
      });
    }
    const novos = await PneuService.createBulkStockPneus(
      pneus.map(normalizeDatesForDb),
    );
    res.status(201).json({
      success: true,
      data: novos,
      message: "Pneus em estoque criados com sucesso",
    });
  }),

  getAllPneus: catchAsync(async (req, res) => {
    const pageParam = req.query.page;
    if (pageParam !== undefined) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = parseListLimit(req.query.limit, 20);
      const emUso =
        req.query.emUso === "true"
          ? true
          : req.query.emUso === "false"
            ? false
            : undefined;
      const { caminhaoId, placa } = req.query;
      const placaFiltro = placa ? String(placa).trim() : undefined;
      const { data, count } = await PneuService.listPaginated({
        page,
        limit,
        caminhaoId,
        emUso,
        placa: placaFiltro,
      });
      return res.status(200).json({
        success: true,
        data,
        pagination: PneuService.buildPagination(page, limit, count),
      });
    }

    const { caminhaoId } = req.query;
    const limit = parseListLimit(req.query.limit);
    const pneus = await PneuService.getAll({ caminhaoId, limit });
    res.status(200).json({ success: true, data: pneus });
  }),

  getPneuById: catchAsync(async (req, res) => {
    const pneu = await PneuService.getById(req.params.id);
    if (!pneu)
      return res
        .status(404)
        .json({ success: false, error: "Pneu não encontrado." });
    res.status(200).json({ success: true, data: pneu });
  }),

  // Mantido para compatibilidade
  getPneusByCaminhao: catchAsync(async (req, res) => {
    const limit = parseListLimit(req.query.limit);
    const pneus = await PneuService.getAll({
      caminhaoId: req.params.id,
      limit,
    });
    res.status(200).json({ success: true, data: pneus });
  }),

  updatePneu: catchAsync(async (req, res) => {
    const pneuValidado = pneuUpdateSchema.parse(req.body);
    const pneuAtualizado = await PneuService.updatePneu(
      req.params.id,
      normalizeDatesForDb(pneuValidado),
    );
    res.status(200).json({
      success: true,
      data: pneuAtualizado,
      message: "Pneu atualizado com sucesso",
    });
  }),

  deletePneu: catchAsync(async (req, res) => {
    await PneuService.delete(req.params.id);
    res.status(204).send();
  }),
};
