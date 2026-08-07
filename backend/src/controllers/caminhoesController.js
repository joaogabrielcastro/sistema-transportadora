// backend/src/controllers/caminhoesController.js
import { CaminhaoService } from "../services/CaminhaoService.js";
import { CaminhaoDocumentoService } from "../services/CaminhaoDocumentoService.js";
import { ComposicaoService } from "../services/ComposicaoService.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import {
  caminhaoSchema,
  caminhaoUpdateSchema,
  vinculoComposicaoSchema,
} from "../schemas/caminhaoSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const caminhoesController = {
  createCaminhao: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const caminhaoValidado = caminhaoSchema.parse(req.body);
    const novoCaminhao = await CaminhaoService.criarCaminhao(
      tenantId,
      caminhaoValidado,
    );

    res.status(201).json({
      success: true,
      data: novoCaminhao,
      message: "Caminhão criado com sucesso",
    });
  }),

  getAllCaminhoes: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const filtro = req.query.filtro || null;
    const termo = req.query.termo || null;
    const tipo_veiculo = req.query.tipo_veiculo || null;

    let page;
    let limit;
    const pageParam = req.query.page;
    const limitParam = req.query.limit;

    if (pageParam === undefined && limitParam === undefined) {
      page = 1;
      limit = 200;
    } else {
      page = Math.max(1, parseInt(req.query.page, 10) || 1);
      limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    }

    const resultado = await CaminhaoService.buscarTodos({
      tenantId,
      page,
      limit,
      filtro,
      termo,
      tipo_veiculo,
    });

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

  getByPlaca: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { placa } = req.params;
    const caminhao = await CaminhaoService.buscarPorPlaca(tenantId, placa);

    res.status(200).json({
      success: true,
      data: caminhao,
    });
  }),

  searchCaminhoes: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { term, tipo_veiculo } = req.query;

    if (!term || term.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "O termo de busca deve ter pelo menos 2 caracteres.",
      });
    }

    const caminhoes = await CaminhaoService.pesquisarCaminhoes(
      tenantId,
      term,
      tipo_veiculo || null,
    );

    res.status(200).json({
      success: true,
      data: caminhoes,
      total: caminhoes.length,
    });
  }),

  updateCaminhao: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { placa } = req.params;
    const caminhaoValidado = caminhaoUpdateSchema.parse(req.body);

    const caminhaoAtualizado = await CaminhaoService.atualizarCaminhao(
      tenantId,
      placa,
      caminhaoValidado,
    );

    res.status(200).json({
      success: true,
      data: caminhaoAtualizado,
      message: "Caminhão atualizado com sucesso",
    });
  }),

  checkDependencies: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { placa } = req.params;
    const dependencias = await CaminhaoService.verificarDependencias(
      tenantId,
      placa,
    );

    res.status(200).json({
      success: true,
      data: {
        temDependencias: dependencias.total > 0,
        detalhes: dependencias.detalhes,
        total: dependencias.total,
      },
    });
  }),

  deleteCaminhao: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { placa } = req.params;
    await CaminhaoService.deletarCaminhao(tenantId, placa);

    res.status(204).send();
  }),

  deleteCaminhaoWithCascade: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { placa } = req.params;
    const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);
    if (caminhao?.id) {
      await CaminhaoDocumentoService.purgeCaminhao(tenantId, caminhao.id);
    }
    await caminhoesModel.deleteWithCascade(tenantId, placa);

    res.status(204).send();
  }),

  updateCaminhaoById: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { id } = req.params;
    const caminhaoValidado = caminhaoUpdateSchema.parse(req.body);

    const caminhaoAtualizado = await CaminhaoService.atualizarCaminhaoPorId(
      tenantId,
      id,
      caminhaoValidado,
    );

    res.status(200).json({
      success: true,
      data: caminhaoAtualizado,
      message: "Caminhão atualizado com sucesso",
    });
  }),

  listarVinculos: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const id = Number(req.params.id);
    const vinculos = await ComposicaoService.listarPorCavalo(tenantId, id);
    res.status(200).json({ success: true, data: vinculos });
  }),

  vincularCarreta: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const id = Number(req.params.id);
    const body = vinculoComposicaoSchema.parse(req.body);
    const vinculo = await ComposicaoService.vincular(tenantId, id, body);
    res.status(201).json({
      success: true,
      data: vinculo,
      message: "Carreta vinculada com sucesso",
    });
  }),

  desvincularCarreta: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const vinculoId = Number(req.params.vinculoId);
    const vinculo = await ComposicaoService.desvincular(tenantId, vinculoId);
    res.status(200).json({
      success: true,
      data: vinculo,
      message: "Carreta desvinculada",
    });
  }),
};
