// backend/src/controllers/pneusController.js
import { pneusModel } from "../models/pneusModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { pneuSchema, pneuUpdateSchema, pneuCreateInStockSchema } from "../schemas/pneuSchema.js";
import { z } from "zod";

export const pneusController = {
  createPneu: async (req, res) => {
    try {
      const pneuValidado = pneuSchema.parse(req.body);
      let novoPneu;

      // Se foi passado stock_pneu_id, atribui diretamente esse pneu do estoque
      if (req.body.stock_pneu_id) {
        novoPneu = await pneusModel.assignFromStock(req.body.stock_pneu_id, pneuValidado);
      } else if (req.body.consume_from_stock) {
        const assigned = await pneusModel.findAndAssignStock(
          { marca: pneuValidado.marca, modelo: pneuValidado.modelo },
          pneuValidado
        );
        if (assigned) novoPneu = assigned;
        else novoPneu = await pneusModel.create(pneuValidado);
      } else {
        novoPneu = await pneusModel.create(pneuValidado);
      }

      // Atualiza KM do caminhão se informado
      if (pneuValidado.km_instalacao) {
        const caminhaoId = pneuValidado.caminhao_id;
        const novoKm = pneuValidado.km_instalacao;
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }

      res.status(201).json(novoPneu);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  },

  createBulkPneus: async (req, res) => {
    try {
      // 1. Definir o schema para a requisição em lote
      const bulkPneuSchema = z.object({
        pneus: z.array(pneuSchema),
      });

      // 2. Validar o corpo da requisição
      const { pneus } = bulkPneuSchema.parse(req.body);

      if (!pneus || pneus.length === 0) {
        return res
          .status(400)
          .json({ error: "A lista de pneus não pode estar vazia." });
      }

      // 3. Chamar o model para criar os pneus em lote
      const novosPneus = await pneusModel.createBulk(pneus);

      // 4. Lógica para atualizar o KM do caminhão com o maior KM do lote
      const caminhaoId = pneus[0].caminhao_id;
      const maxKm = Math.max(...pneus.map((p) => p.km_instalacao || 0));

      if (maxKm > 0) {
        const caminhao = await caminhoesModel.getById(caminhaoId); // Supondo que getById exista
        if (caminhao && maxKm > caminhao.km_atual) {
          await caminhoesModel.updateById(caminhaoId, { km_atual: maxKm });
        }
      }

      res.status(201).json(novosPneus);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos.", details: error.errors });
      }
      console.error("Erro ao criar pneus em lote:", error);
      res
        .status(500)
        .json({ error: "Erro interno ao processar a requisição." });
    }
  },

  // Criar um pneu apenas para o estoque (sem vínculo a caminhão)
  createStockPneu: async (req, res) => {
    try {
      const pneuValidado = pneuCreateInStockSchema.parse(req.body);

      const payload = {
        ...pneuValidado,
        caminhao_id: null,
        posicao_id: pneuValidado.posicao_id ?? null,
      };

      const novoPneu = await pneusModel.create(payload);
      res.status(201).json(novoPneu);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("Erro ao criar pneu em estoque:", error);
      res.status(500).json({ error: "Erro interno ao criar pneu em estoque." });
    }
  },

  // Listar pneus em estoque
  getInStockPneus: async (req, res) => {
    try {
      const pneus = await pneusModel.getInStock();
      res.status(200).json(pneus);
    } catch (error) {
      console.error("Erro ao listar pneus em estoque:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Criar pneus em lote diretamente no estoque
  createBulkStockPneus: async (req, res) => {
    try {
      const bulkSchema = z.object({
        pneus: z.array(pneuCreateInStockSchema),
      });

      const { pneus } = bulkSchema.parse(req.body);

      if (!pneus || pneus.length === 0) {
        return res.status(400).json({ error: "A lista de pneus não pode estar vazia." });
      }

      const payload = pneus.map((p) => ({ ...p, caminhao_id: null, posicao_id: p.posicao_id ?? null }));

      const novos = await pneusModel.createBulk(payload);
      res.status(201).json(novos);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("Erro ao criar pneus em lote no estoque:", error);
      res.status(500).json({ error: "Erro interno ao criar pneus em lote." });
    }
  },

  getAllPneus: async (req, res) => {
    try {
      const { caminhaoId } = req.query;
      let pneus;
      if (caminhaoId) {
        pneus = await pneusModel.getByCaminhaoId(caminhaoId);
      } else {
        pneus = await pneusModel.getAll();
      }
      res.status(200).json(pneus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPneuById: async (req, res) => {
    try {
      const pneu = await pneusModel.getById(req.params.id);
      if (!pneu) {
        return res.status(404).json({ error: "Pneu não encontrado." });
      }
      res.status(200).json(pneu);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPneusByCaminhao: async (req, res) => {
    try {
      const { id } = req.params;
      const pneus = await pneusModel.getByCaminhaoId(id);
      res.status(200).json(pneus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updatePneu: async (req, res) => {
    try {
      const pneuValidado = pneuUpdateSchema.parse(req.body);
      const pneuAtualizado = await pneusModel.update(
        req.params.id,
        pneuValidado
      );

      // Nova lógica para atualizar o KM do caminhão
      if (pneuValidado.km_instalacao) {
        const pneu = await pneusModel.getById(req.params.id);
        const caminhaoId = pneu.caminhao_id;
        const novoKm = pneuValidado.km_instalacao;
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }

      res.status(200).json(pneuAtualizado);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: error.message });
    }
  },

  deletePneu: async (req, res) => {
    try {
      await pneusModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};
