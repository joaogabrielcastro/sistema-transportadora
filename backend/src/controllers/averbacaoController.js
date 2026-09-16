import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";
import {
  averbacaoIdParamSchema,
  solicitarAverbacaoSchema,
} from "../schemas/averbacaoSchema.js";
import { AverbacaoService } from "../services/averbacao/AverbacaoService.js";

export const averbacaoController = {
  getConfig: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await AverbacaoService.getConfig(tenantId),
    });
  }),

  saveConfig: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await AverbacaoService.saveConfig(tenantId, req.body),
      message: "Configuração de seguro/averbação salva",
    });
  }),

  testarConexao: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await AverbacaoService.testarConexao(tenantId);
    res.json({
      success: data.ok,
      data,
      message: data.message,
    });
  }),

  solicitar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const dto = solicitarAverbacaoSchema.parse(req.body);
    res.status(202).json({
      success: true,
      data: await AverbacaoService.solicitar(tenantId, dto),
      message: "Averbação enfileirada",
    });
  }),

  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { id } = averbacaoIdParamSchema.parse(req.params);
    res.json({
      success: true,
      data: await AverbacaoService.getById(tenantId, id),
    });
  }),

  consultar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { id } = averbacaoIdParamSchema.parse(req.params);
    res.json({
      success: true,
      data: await AverbacaoService.consultar(tenantId, id),
    });
  }),

  reprocessar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { id } = averbacaoIdParamSchema.parse(req.params);
    res.status(202).json({
      success: true,
      data: await AverbacaoService.reprocessar(tenantId, id),
      message: "Reprocessamento enfileirado",
    });
  }),

  cancelar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { id } = averbacaoIdParamSchema.parse(req.params);
    res.status(202).json({
      success: true,
      data: await AverbacaoService.cancelar(tenantId, id),
      message: "Cancelamento de averbação enfileirado",
    });
  }),
};
