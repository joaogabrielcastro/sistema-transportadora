// backend/src/controllers/pneusController.js
import { PneuService } from "../services/PneuService.js";
import {
  pneuSchema,
  pneuUpdateSchema,
  pneuCreateInStockSchema,
} from "../schemas/pneuSchema.js";
import { z } from "zod";
import { catchAsync } from "../utils/catchAsync.js";

// Função genérica para converter todos os campos de data dd/MM/yyyy para yyyy-MM-dd
function converterDatasBody(body) {
  const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  for (const key in body) {
    if (
      key.toLowerCase().includes("data") &&
      typeof body[key] === "string" &&
      dataRegex.test(body[key])
    ) {
      const [dia, mes, ano] = body[key].split("/");
      body[key] = `${ano}-${mes}-${dia}`;
    }
  }
  return body;
}

export const pneusController = {
  createPneu: catchAsync(async (req, res) => {
    converterDatasBody(req.body);
    // Validação Schema Básico
    let dados;
    if (req.body.stock_pneu_id) {
      dados = pneuSchema.partial().parse(req.body);
    } else {
      dados = pneuSchema.parse(req.body);
    }
    const novoPneu = await PneuService.createPneu(dados, {
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
    if (Array.isArray(req.body.pneus)) {
      req.body.pneus = req.body.pneus.map((pneu) => converterDatasBody(pneu));
    }
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
    converterDatasBody(req.body);
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
    if (Array.isArray(req.body.pneus)) {
      req.body.pneus = req.body.pneus.map((pneu) => converterDatasBody(pneu));
    }
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
    converterDatasBody(req.body);
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
    try {
      await PneuService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar pneu:", error);
      res.status(400).json({
        error: error.message || "Erro ao excluir pneu",
        details: error.toString(),
      });
    }
  }),
};
