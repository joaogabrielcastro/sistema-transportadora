import { catchAsync } from "../utils/catchAsync.js";
import { CaminhaoDocumentoService } from "../services/CaminhaoDocumentoService.js";
import { requireTenantId } from "../utils/tenant.js";

export const loadCaminhaoForUpload = catchAsync(async (req, _res, next) => {
  const tenantId = requireTenantId(req);
  const caminhao = await CaminhaoDocumentoService.resolveCaminhao(
    tenantId,
    req.params.placa,
  );
  req.caminhaoUpload = { id: caminhao.id };
  next();
});

export const caminhaoDocumentosController = {
  listar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await CaminhaoDocumentoService.listar(tenantId, req.params.placa);
    res.status(200).json({ success: true, data });
  }),

  upload: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const files = Array.isArray(req.files) ? req.files : [];
    const criados = await CaminhaoDocumentoService.upload(
      tenantId,
      req.params.placa,
      files,
    );
    res.status(201).json({
      success: true,
      data: criados,
      message:
        criados.length === 1
          ? "PDF anexado com sucesso"
          : `${criados.length} PDFs anexados com sucesso`,
    });
  }),

  download: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { doc, absolute } = await CaminhaoDocumentoService.obterArquivo(
      tenantId,
      req.params.placa,
      req.params.docId,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.nome_original)}"`,
    );
    res.sendFile(absolute);
  }),

  remover: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    await CaminhaoDocumentoService.remover(tenantId, req.params.placa, req.params.docId);
    res.status(200).json({
      success: true,
      message: "Documento removido com sucesso",
    });
  }),
};
