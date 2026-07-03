import { catchAsync } from "../utils/catchAsync.js";
import { OrdemColetaService } from "../services/OrdemColetaService.js";
import {
  ordemColetaPreviewSchema,
  ordemColetaPdfSchema,
  ordemColetaEnviarSchema,
  ordemColetaHistoricoQuerySchema,
} from "../schemas/ordemColetaSchema.js";

const badRequest = (res, issues) => {
  return res.status(400).json({
    success: false,
    error: "Dados inválidos",
    details: issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  });
};

export const ordemColetaController = {
  historico: catchAsync(async (req, res) => {
    const parsed = ordemColetaHistoricoQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return badRequest(res, parsed.error.issues);
    }
    const { page, limit } = parsed.data;
    const result = await OrdemColetaService.listarHistorico({ page, limit });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      totalFalhas: result.totalFalhas,
    });
  }),

  preview: catchAsync(async (req, res) => {
    const parsed = ordemColetaPreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.issues);
    }
    const vars = await OrdemColetaService.mergeVars(parsed.data);
    const html = OrdemColetaService.buildHtml(parsed.data.tipo, vars);
    res.status(200).json({
      success: true,
      data: { html },
    });
  }),

  pdf: catchAsync(async (req, res) => {
    const parsed = ordemColetaPdfSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.issues);
    }
    const vars = await OrdemColetaService.mergeVars(parsed.data);
    const html = OrdemColetaService.buildHtml(parsed.data.tipo, vars);
    const pdfBuffer = await OrdemColetaService.htmlToPdfBuffer(html);
    const prefix = OrdemColetaService.filenamePrefix(parsed.data.tipo);
    const filename = `${prefix}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  }),

  enviar: catchAsync(async (req, res) => {
    const parsed = ordemColetaEnviarSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.issues);
    }
    const result = await OrdemColetaService.iniciarEnvioAssincrono(parsed.data);
    res.status(202).json({
      success: true,
      data: result,
      message:
        "Envio enfileirado. O PDF será gerado e o e-mail enviado em segundo plano.",
    });
  }),

  statusEnvio: catchAsync(async (req, res) => {
    const status = await OrdemColetaService.consultarStatusEnvio(req.params.id);
    res.status(200).json({ success: true, data: status });
  }),

  excluirFalhas: catchAsync(async (req, res) => {
    const removidos = await OrdemColetaService.excluirEnviosComFalha();
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
