// backend/src/controllers/pneusController.js
import { PneuService } from "../services/PneuService.js";
import {
  pneuSchema,
  pneuUpdateSchema,
  pneuCreateInStockSchema,
} from "../schemas/pneuSchema.js";
import { z } from "zod";
import { catchAsync } from "../utils/catchAsync.js";

export const pneusController = {
  createPneu: catchAsync(async (req, res) => {
    const { body } = req;

    // Validação Schema Básico
    // Nota: A lógica de partial vs full schema para atribuição poderia ser movida pra dentro do Service
    // se passássemos o body bruto, mas pra manter o contrato do controller limpo, validamos aqui.
    let dados;
    if (body.stock_pneu_id) {
      dados = pneuSchema.partial().parse(body);
    } else {
      dados = pneuSchema.parse(body);
    }

    const novoPneu = await PneuService.createPneu(dados, {
      stock_pneu_id: body.stock_pneu_id,
      consume_from_stock: body.consume_from_stock,
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
      return res
        .status(400)
        .json({ error: "A lista de pneus não pode estar vazia." });
    }

    const novosPneus = await PneuService.createBulkPneus(pneus);
    res.status(201).json({ success: true, data: novosPneus });
  }),

  // Criar um pneu apenas para o estoque
  createStockPneu: catchAsync(async (req, res) => {
    const pneuValidado = pneuCreateInStockSchema.parse(req.body);
    const novoPneu = await PneuService.createStockPneu(pneuValidado);
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
      return res.status(400).json({ error: "Lista vazia." });
    }

    const novos = await PneuService.createBulkStockPneus(pneus);
    res.status(201).json({ success: true, data: novos });
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
      pneuValidado,
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
