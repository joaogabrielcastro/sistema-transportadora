import { gastosModel } from "../models/gastosModel.js";
import { caminhoesModel } from "../models/caminhoesModel.js";

export const gastosController = {
  createGasto: async (req, res) => {
    try {
      // Primeiro, cria o registo do gasto
      const novoGasto = await gastosModel.create(req.body);

      // --- LÓGICA DE ATUALIZAÇÃO DO KM CENTRALIZADA ---
      // Se o novo gasto inclui uma quilometragem, atualizamos o camião.
      const novoKm = req.body.km_registro;
      const caminhaoId = req.body.caminhao_id;

      if (caminhaoId && novoKm) {
        // Não é preciso verificar o tipo de gasto. Qualquer registo com KM deve atualizar o camião.
        await caminhoesModel.updateById(caminhaoId, { km_atual: novoKm });
      }
      // --- FIM DA LÓGICA DE ATUALIZAÇÃO ---

      // VERIFICAÇÃO ADICIONADA: Checa se a criação do gasto retornou dados válidos
      if (novoGasto && novoGasto.length > 0) {
        res.status(201).json(novoGasto[0]);
      } else {
        // Se 'novoGasto' for null ou um array vazio, envia uma resposta de sucesso genérica.
        // Isto previne o erro e informa ao frontend que a operação foi bem-sucedida.
        res.status(201).json({ message: "Gasto criado com sucesso." });
      }
    } catch (error) {
      console.error("ERRO AO CRIAR GASTO:", error); // Adicionado para melhor depuração
      res.status(400).json({ error: error.message });
    }
  },

  getAllGastos: async (req, res) => {
    try {
      const gastos = await gastosModel.getAll();
      res.status(200).json(gastos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getGastoById: async (req, res) => {
    try {
      const gasto = await gastosModel.getById(req.params.id);
      if (!gasto) {
        return res.status(404).json({ error: "Gasto não encontrado." });
      }
      res.status(200).json(gasto);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getGastosByCaminhaoId: async (req, res) => {
    try {
      const gastos = await gastosModel.getByCaminhaoId(req.params.caminhaoId);
      res.status(200).json(gastos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateGasto: async (req, res) => {
    try {
      const gastoAtualizado = await gastosModel.update(req.params.id, req.body);
      res.status(200).json(gastoAtualizado);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  deleteGasto: async (req, res) => {
    try {
      await gastosModel.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getConsumoCombustivel: async (req, res) => {
    try {
      const consumoData = await gastosModel.getConsumoCombustivel(
        req.params.id
      );
      res.status(200).json(consumoData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

