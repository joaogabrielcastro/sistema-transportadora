import { NotaFiscalService, EstoqueService } from "../services/NotaFiscalService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

function bufferFromFile(file) {
  if (!file) return null;
  return file.buffer;
}

export const notasFiscaisController = {
  listar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const resultado = await NotaFiscalService.listar(tenantId, { page, limit });
    res.json({
      success: true,
      data: resultado.data,
      pagination: {
        currentPage: page,
        totalItems: resultado.count,
        totalPages: Math.ceil(resultado.count / limit),
      },
    });
  }),

  getById: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await NotaFiscalService.getById(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  preview: catchAsync(async (req, res) => {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({
        success: false,
        error: "Envie o arquivo XML da NF-e (campo xml)",
      });
    }
    const xml = file.buffer.toString("utf8");
    const data = await NotaFiscalService.previewFromXml(xml);
    res.json({ success: true, data });
  }),

  importar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const xmlFile = req.files?.xml?.[0];
    const pdfFile = req.files?.pdf?.[0];

    let parsed;
    if (req.body?.payload) {
      parsed =
        typeof req.body.payload === "string"
          ? JSON.parse(req.body.payload)
          : req.body.payload;
    } else if (xmlFile?.buffer) {
      parsed = await NotaFiscalService.previewFromXml(
        xmlFile.buffer.toString("utf8"),
      );
    } else {
      return res.status(400).json({
        success: false,
        error: "Envie o XML ou um payload JSON com os itens da nota",
      });
    }

    const nota = await NotaFiscalService.confirmarImportacao(tenantId, parsed);

    if (xmlFile || pdfFile) {
      await NotaFiscalService.salvarArquivos(tenantId, nota.id, {
        xmlBuffer: bufferFromFile(xmlFile),
        xmlName: xmlFile?.originalname || "nfe.xml",
        pdfBuffer: bufferFromFile(pdfFile),
        pdfName: pdfFile?.originalname || "danfe.pdf",
      });
    }

    const completa = await NotaFiscalService.getById(tenantId, nota.id);
    res.status(201).json({
      success: true,
      data: completa,
      message: "Nota importada e estoque atualizado",
    });
  }),

  listarProdutos: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const resultado = await EstoqueService.listarProdutos(tenantId, {
      page,
      limit,
      termo: req.query.termo,
    });
    res.json({
      success: true,
      data: resultado.data,
      pagination: {
        currentPage: page,
        totalItems: resultado.count,
        totalPages: Math.ceil(resultado.count / limit),
      },
    });
  }),

  baixarEstoque: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await EstoqueService.baixar(tenantId, req.body || {});
    res.status(201).json({
      success: true,
      data,
      message: "Baixa registrada",
    });
  }),

  listarMovimentos: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const resultado = await EstoqueService.listarMovimentos(tenantId, {
      page,
      limit,
      produto_id: req.query.produto_id,
    });
    res.json({
      success: true,
      data: resultado.data,
      pagination: {
        currentPage: page,
        totalItems: resultado.count,
        totalPages: Math.ceil(resultado.count / limit),
      },
    });
  }),
};
