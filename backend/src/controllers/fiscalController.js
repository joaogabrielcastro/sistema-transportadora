import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";
import {
  cancelarDocumentoSchema,
  vincularManifestoSchema,
} from "../schemas/fiscalSchema.js";
import { FiscalEmpresaService } from "../services/fiscal/FiscalEmpresaService.js";
import { FiscalClienteService } from "../services/fiscal/FiscalClienteService.js";
import { FiscalVeiculoDadosService } from "../services/fiscal/FiscalVeiculoDadosService.js";
import { CteService } from "../services/fiscal/CteService.js";
import { MdfeService } from "../services/fiscal/MdfeService.js";
import { CiotService } from "../services/fiscal/CiotService.js";

// ------------------------- Empresas fiscais -------------------------
export const fiscalEmpresasController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({ success: true, data: await FiscalEmpresaService.list(tenantId) });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalEmpresaService.getById(tenantId, req.params.id),
    });
  }),
  create: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await FiscalEmpresaService.create(tenantId, req.body),
    });
  }),
  update: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalEmpresaService.update(tenantId, req.params.id, req.body),
    });
  }),
  remove: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalEmpresaService.remove(tenantId, req.params.id),
    });
  }),
};

// --------------------------- Clientes ------------------------------
export const fiscalClientesController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalClienteService.list(tenantId, { q: req.query.q }),
    });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalClienteService.getById(tenantId, req.params.id),
    });
  }),
  create: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await FiscalClienteService.create(tenantId, req.body),
    });
  }),
  update: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalClienteService.update(tenantId, req.params.id, req.body),
    });
  }),
  remove: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalClienteService.remove(tenantId, req.params.id),
    });
  }),
};

// --------------------- Dados fiscais do veículo -------------------
export const fiscalVeiculoDadosController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalVeiculoDadosService.list(tenantId),
    });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalVeiculoDadosService.getByCaminhao(
        tenantId,
        req.params.caminhaoId,
      ),
    });
  }),
  upsert: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await FiscalVeiculoDadosService.upsert(tenantId, req.body),
    });
  }),
  update: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalVeiculoDadosService.update(
        tenantId,
        req.params.caminhaoId,
        req.body,
      ),
    });
  }),
  remove: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await FiscalVeiculoDadosService.remove(
        tenantId,
        req.params.caminhaoId,
      ),
    });
  }),
};

// ----------------------------- CT-e ------------------------------
export const cteController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CteService.list(tenantId, { status: req.query.status }),
    });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CteService.getById(tenantId, req.params.id),
    });
  }),
  emitir: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await CteService.emitir(tenantId, req.body),
      message: "CT-e emitido",
    });
  }),
  cancelar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { justificativa } = cancelarDocumentoSchema.parse(req.body);
    res.json({
      success: true,
      data: await CteService.cancelar(tenantId, req.params.id, justificativa),
      message: "Cancelamento de CT-e processado",
    });
  }),
  vincularManifesto: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { manifesto_id } = vincularManifestoSchema.parse(req.body);
    res.json({
      success: true,
      data: await CteService.vincularManifesto(
        tenantId,
        req.params.id,
        manifesto_id,
      ),
    });
  }),
};

// ----------------------------- MDF-e -----------------------------
export const mdfeController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await MdfeService.list(tenantId, { status: req.query.status }),
    });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await MdfeService.getById(tenantId, req.params.id),
    });
  }),
  previewReboques: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await MdfeService.previewReboques(tenantId, {
        caminhao_id: req.query.caminhao_id,
        data_emissao: req.query.data_emissao,
      }),
    });
  }),
  emitir: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await MdfeService.emitir(tenantId, req.body),
      message: "MDF-e emitido",
    });
  }),
  encerrar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await MdfeService.encerrar(tenantId, req.params.id),
      message: "Encerramento de MDF-e processado",
    });
  }),
  cancelar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { justificativa } = cancelarDocumentoSchema.parse(req.body);
    res.json({
      success: true,
      data: await MdfeService.cancelar(tenantId, req.params.id, justificativa),
      message: "Cancelamento de MDF-e processado",
    });
  }),
};

// ----------------------------- CIOT -----------------------------
export const ciotController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CiotService.list(tenantId, { status: req.query.status }),
    });
  }),
  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CiotService.getById(tenantId, req.params.id),
    });
  }),
  declarar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.status(201).json({
      success: true,
      data: await CiotService.declarar(tenantId, req.body),
      message: "CIOT declarado",
    });
  }),
  cancelar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { justificativa } = cancelarDocumentoSchema.parse(req.body);
    res.json({
      success: true,
      data: await CiotService.cancelar(tenantId, req.params.id, justificativa),
      message: "Cancelamento de CIOT processado",
    });
  }),
  encerrar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CiotService.encerrar(tenantId, req.params.id),
      message: "Encerramento de CIOT processado",
    });
  }),
  consultarSituacaoTransportador: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CiotService.consultarSituacaoTransportador(tenantId, req.body),
    });
  }),
  consultarCiotGerado: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({
      success: true,
      data: await CiotService.consultarCiotGerado(tenantId, req.params.id),
    });
  }),
};
