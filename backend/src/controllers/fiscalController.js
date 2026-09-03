import archiver from "archiver";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";
import { logger } from "../utils/logger.js";
import {
  cancelarDocumentoSchema,
  downloadLoteSchema,
  vincularManifestoSchema,
} from "../schemas/fiscalSchema.js";
import { FiscalEmpresaService } from "../services/fiscal/FiscalEmpresaService.js";
import { FiscalClienteService } from "../services/fiscal/FiscalClienteService.js";
import { FiscalVeiculoDadosService } from "../services/fiscal/FiscalVeiculoDadosService.js";
import { CteService } from "../services/fiscal/CteService.js";
import { MdfeService } from "../services/fiscal/MdfeService.js";
import { CiotService } from "../services/fiscal/CiotService.js";
import { FiscalDownloadService } from "../services/fiscal/FiscalDownloadService.js";

// ---------------------- Download de CT-e/MDF-e (XML/PDF) ----------------------
// Fábricas de handler reaproveitadas por cteController e mdfeController. Mesmo
// princípio do caminhaoDocumentosController.download: resolve o caminho absoluto
// só a partir do que está gravado no banco e serve o arquivo autenticado.

/** GET /fiscal/{cte|mdfe}/:id/{pdf|xml} — download individual. */
function baixarArquivoFiscal(tipo, formato) {
  return catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { absoluto, contentType, downloadName } =
      await FiscalDownloadService.obterArquivo(
        tipo,
        tenantId,
        req.params.id,
        formato,
      );
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `${formato === "pdf" ? "inline" : "attachment"}; filename="${downloadName}"`,
    );
    res.sendFile(absoluto);
  });
}

/** POST /fiscal/{cte|mdfe}/download-lote — zip com PDF+XML de vários documentos. */
function baixarLoteFiscal(tipo) {
  return catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { ids } = downloadLoteSchema.parse(req.body);
    const resultado = await FiscalDownloadService.coletarArquivosLote(
      tipo,
      tenantId,
      ids,
    );

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${tipo}-lote-${stamp}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (err) => {
      logger.warn("archiver warning no download em lote fiscal", {
        tipo,
        message: err.message,
      });
    });
    archive.on("error", (err) => {
      logger.error("Falha ao gerar o zip do download em lote fiscal", {
        tipo,
        tenantId,
        message: err.message,
      });
      res.destroy(err);
    });
    archive.pipe(res);

    for (const entrada of resultado.entradas) {
      archive.file(entrada.absoluto, { name: entrada.nome });
    }
    if (resultado.pulados.length > 0 || resultado.ignorados.length > 0) {
      archive.append(FiscalDownloadService.montarManifest(resultado), {
        name: "manifest.txt",
      });
    }
    await archive.finalize();
  });
}

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
  baixarPdf: baixarArquivoFiscal("cte", "pdf"),
  baixarXml: baixarArquivoFiscal("cte", "xml"),
  baixarLote: baixarLoteFiscal("cte"),
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
      data: await MdfeService.encerrar(tenantId, req.params.id, req.body),
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
  baixarPdf: baixarArquivoFiscal("mdfe", "pdf"),
  baixarXml: baixarArquivoFiscal("mdfe", "xml"),
  baixarLote: baixarLoteFiscal("mdfe"),
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
