// backend/src/controllers/pneusController.js
import { PneuService } from "../services/PneuService.js";
import {
  pneuSchema,
  pneuUpdateSchema,
  pneuCreateInStockSchema,
} from "../schemas/pneuSchema.js";
import { z } from "zod";
import { catchAsync } from "../utils/catchAsync.js";
import { normalizeDatesForDb } from "../utils/dates.js";

export const pneusController = {
  createPneu: catchAsync(async (req, res) => {
    // Validação Schema Básico
    let dados;
    if (req.body.stock_pneu_id) {
      dados = pneuSchema.partial().parse(req.body);
    } else {
      dados = pneuSchema.parse(req.body);
    }
    const novoPneu = await PneuService.createPneu(normalizeDatesForDb(dados), {
      stock_pneu_id: req.body.stock_pneu_id,
      consume_from_stock: req.body.consume_from_stock,
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

  // Criar um pneu apenas para o estoque
  createStockPneu: catchAsync(async (req, res) => {
    const pneuValidado = pneuCreateInStockSchema.parse(req.body);
    const novoPneu = await PneuService.createStockPneu(
      normalizeDatesForDb(pneuValidado),
    );
    res.status(201).json({ success: true, data: novoPneu });
  }),

  // Listar pneus em estoque
  getInStockPneus: catchAsync(async (req, res) => {
    const pneus = await PneuService.getInStock();
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
    const { caminhaoId } = req.query;
    const pneus = await PneuService.getAll({ caminhaoId });
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
    const pneus = await PneuService.getAll({ caminhaoId: req.params.id });
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
