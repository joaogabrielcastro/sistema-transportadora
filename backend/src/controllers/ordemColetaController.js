import { catchAsync } from "../utils/catchAsync.js";
import { OrdemColetaService } from "../services/OrdemColetaService.js";
import {
  ordemColetaPreviewSchema,
  ordemColetaPdfSchema,
  ordemColetaEnviarSchema,
  ordemColetaHistoricoQuerySchema,
} from "../schemas/ordemColetaSchema.js";
import { requireTenantId } from "../utils/tenant.js";

export const ordemColetaController = {
  historico: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { page, limit } = ordemColetaHistoricoQuerySchema.parse(req.query);
    const result = await OrdemColetaService.listarHistorico(tenantId, {
      page,
      limit,
    });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      totalFalhas: result.totalFalhas,
    });
  }),

  preview: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = ordemColetaPreviewSchema.parse(req.body);
    const vars = await OrdemColetaService.mergeVars({ tenantId, ...parsed });
    const html = OrdemColetaService.buildHtml(parsed.tipo, vars);
    res.status(200).json({
      success: true,
      data: { html },
    });
  }),

  pdf: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = ordemColetaPdfSchema.parse(req.body);
    const vars = await OrdemColetaService.mergeVars({ tenantId, ...parsed });
    const html = OrdemColetaService.buildHtml(parsed.tipo, vars);
    const pdfBuffer = await OrdemColetaService.htmlToPdfBuffer(html);
    const prefix = OrdemColetaService.filenamePrefix(parsed.tipo);
    const filename = `${prefix}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  }),

  enviar: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = ordemColetaEnviarSchema.parse(req.body);
    const result = await OrdemColetaService.iniciarEnvioAssincrono(
      tenantId,
      parsed,
    );
    res.status(202).json({
      success: true,
      data: result,
      message:
        "Envio enfileirado. O PDF será gerado e o e-mail enviado em segundo plano.",
    });
  }),

  statusEnvio: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const status = await OrdemColetaService.consultarStatusEnvio(
      tenantId,
      req.params.id,
    );
    res.status(200).json({ success: true, data: status });
  }),

  excluirFalhas: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const dias = req.query.dias ? Number(req.query.dias) : 30;
    const removidos = await OrdemColetaService.excluirEnviosComFalha(tenantId, {
      dias,
    });
    res.status(200).json({
      success: true,
      data: { removidos },
      message:
        removidos > 0
          ? `${removidos} registro(s) com falha removido(s).`
          : "Nenhum registro com falha encontrado.",
    });
  }),
};
