// backend/src/controllers/caminhoesController.js
import { CaminhaoService } from "../services/CaminhaoService.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  caminhaoSchema,
  caminhaoUpdateSchema,
} from "../schemas/caminhaoSchema.js";
import { catchAsync } from "../utils/catchAsync.js";

export const caminhoesController = {
  createCaminhao: catchAsync(async (req, res) => {
    const caminhaoValidado = caminhaoSchema.parse(req.body);
    const novoCaminhao = await CaminhaoService.criarCaminhao(caminhaoValidado);

    res.status(201).json({
      success: true,
      data: novoCaminhao,
      message: "Caminhão criado com sucesso",
    });
  }),

  // Listar todos os caminhões com paginação e busca
  getAllCaminhoes: catchAsync(async (req, res) => {
    const filtro = req.query.filtro || null;
    const termo = req.query.termo || null;

    // Se nenhum parâmetro de paginação for fornecido, retornar TODOS os caminhões
    let page;
    let limit;
    const pageParam = req.query.page;
    const limitParam = req.query.limit;

    if (pageParam === undefined && limitParam === undefined) {
      page = 1;
      limit = null;
    } else {
      page = Math.max(1, parseInt(req.query.page, 10) || 1);
      limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    }

    const resultado = await CaminhaoService.buscarTodos({
      page,
      limit,
      filtro,
      termo,
    });

    // Se não houve paginação, retornar apenas os dados (compatível com chamadas que esperam array)
    if (limit === null) {
      return res.status(200).json({ success: true, data: resultado.data });
    }

    res.status(200).json({
      success: true,
      data: resultado.data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(resultado.count / limit),
        totalItems: resultado.count,
        itemsPerPage: limit,
      },
    });
  }),

  // Buscar caminhão por placa
  getByPlaca: catchAsync(async (req, res) => {
    const { placa } = req.params;
    const caminhao = await CaminhaoService.buscarPorPlaca(placa);

    res.status(200).json({
      success: true,
      data: caminhao,
    });
  }),

  // Buscar caminhões por placa ou motorista
  searchCaminhoes: catchAsync(async (req, res) => {
    const { term } = req.query;

    if (!term || term.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "O termo de busca deve ter pelo menos 2 caracteres.",
      });
    }

    const caminhoes = await CaminhaoService.pesquisarCaminhoes(term);

    res.status(200).json({
      success: true,
      data: caminhoes,
      total: caminhoes.length,
    });
  }),

  // Atualizar caminhão
  updateCaminhao: catchAsync(async (req, res) => {
    const { placa } = req.params;
    const caminhaoValidado = caminhaoUpdateSchema.parse(req.body);

    const caminhaoAtualizado = await CaminhaoService.atualizarCaminhao(
      placa,
      caminhaoValidado,
    );

    res.status(200).json({
      success: true,
      data: caminhaoAtualizado,
      message: "Caminhão atualizado com sucesso",
    });
  }),

  // Verificar dependências antes de excluir
  checkDependencies: catchAsync(async (req, res) => {
    const { placa } = req.params;
    const dependencias = await CaminhaoService.verificarDependencias(placa);

    res.status(200).json({
      success: true,
      data: {
        temDependencias: dependencias.total > 0,
        detalhes: dependencias.detalhes,
        total: dependencias.total,
      },
    });
  }),

  // Deletar caminhão
  deleteCaminhao: catchAsync(async (req, res) => {
    const { placa } = req.params;
    await CaminhaoService.deletarCaminhao(placa);

    res.status(204).send();
  }),

  // Deletar caminhão com cascata (remove todos os registros relacionados)
  deleteCaminhaoWithCascade: catchAsync(async (req, res) => {
    const { placa } = req.params;
    await caminhoesModel.deleteWithCascade(placa);

    res.status(204).send();
  }),

  // Atualizar caminhão por ID (usado pelo frontend quando se tem apenas o id)
  updateCaminhaoById: catchAsync(async (req, res) => {
    const { id } = req.params;
    const caminhaoData = req.body;

    const caminhaoAtualizado = await caminhoesModel.updateById(
      id,
      caminhaoData,
    );

    res.status(200).json({
      success: true,
      data: caminhaoAtualizado,
      message: "Caminhão atualizado por id com sucesso",
    });
  }),
};
