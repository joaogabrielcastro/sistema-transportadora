import { Router } from "express";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  uploadCertificadoFiscal,
  handleCertificadoMulterError,
} from "../middleware/uploadCertificadoFiscal.js";
import {
  fiscalEmpresasController,
  fiscalClientesController,
  fiscalVeiculoDadosController,
  cteController,
  mdfeController,
  ciotController,
  contratoFreteController,
} from "../controllers/fiscalController.js";
import { averbacaoController } from "../controllers/averbacaoController.js";

// Montado em app.js como:
//   apiRouter.use("/fiscal", requireFeature("transporte_fiscal"), fiscalRoutes)
// -> requireAuth + requireActiveSubscription + auditLog já aplicados antes.
const router = Router();

// --- Cadastros de apoio (empresa emissora, cliente/tomador, dados fiscais do veículo) ---
// Leitura: qualquer permissão de leitura fiscal serve. Escrita de empresa:
// qualquer escrita fiscal (CT-e / MDF-e / CIOT), porque o certificado é compartilhado.
const anyFiscalRead = [
  PERMISSIONS.CTE_READ,
  PERMISSIONS.MDFE_READ,
  PERMISSIONS.CIOT_READ,
];
const requireAnyFiscalRead = (req, res, next) => {
  const perms = req.context?.user?.permissions || [];
  if (anyFiscalRead.some((p) => perms.includes(p))) return next();
  return res.status(403).json({
    success: false,
    error: "Sem permissão para esta operação",
    required: anyFiscalRead,
  });
};

const anyFiscalWrite = [
  PERMISSIONS.CTE_WRITE,
  PERMISSIONS.MDFE_WRITE,
  PERMISSIONS.CIOT_WRITE,
];
const requireAnyFiscalWrite = (req, res, next) => {
  const perms = req.context?.user?.permissions || [];
  if (anyFiscalWrite.some((p) => perms.includes(p))) return next();
  return res.status(403).json({
    success: false,
    error: "Sem permissão para esta operação",
    required: anyFiscalWrite,
  });
};

const empresas = Router();
empresas.get("/", requireAnyFiscalRead, fiscalEmpresasController.list);
empresas.get("/:id", requireAnyFiscalRead, fiscalEmpresasController.get);
empresas.post("/", requireAnyFiscalWrite, fiscalEmpresasController.create);
empresas.put("/:id", requireAnyFiscalWrite, fiscalEmpresasController.update);
const runUploadCertificadoFiscal = (req, res, next) => {
  uploadCertificadoFiscal(req, res, (err) => {
    if (err) return handleCertificadoMulterError(err, req, res, next);
    next();
  });
};

empresas.post(
  "/:id/certificado",
  requireAnyFiscalWrite,
  runUploadCertificadoFiscal,
  fiscalEmpresasController.enviarCertificado,
);
empresas.post(
  "/:id/certificado/verificar",
  requireAnyFiscalWrite,
  fiscalEmpresasController.verificarCertificado,
);
empresas.delete(
  "/:id",
  requireAnyFiscalWrite,
  fiscalEmpresasController.remove,
);
router.use("/empresas", empresas);

const clientes = Router();
clientes.get("/", requireAnyFiscalRead, fiscalClientesController.list);
clientes.get("/:id", requireAnyFiscalRead, fiscalClientesController.get);
clientes.post(
  "/",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalClientesController.create,
);
clientes.put(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalClientesController.update,
);
clientes.delete(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalClientesController.remove,
);
router.use("/clientes", clientes);

const veiculoDados = Router();
veiculoDados.get("/", requireAnyFiscalRead, fiscalVeiculoDadosController.list);
veiculoDados.get(
  "/:caminhaoId",
  requireAnyFiscalRead,
  fiscalVeiculoDadosController.get,
);
veiculoDados.post(
  "/",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalVeiculoDadosController.upsert,
);
veiculoDados.put(
  "/:caminhaoId",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalVeiculoDadosController.update,
);
veiculoDados.delete(
  "/:caminhaoId",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalVeiculoDadosController.remove,
);
router.use("/veiculo-dados", veiculoDados);

// --------------------------------- CT-e ---------------------------------
const cte = Router();
cte.get("/", requirePermission(PERMISSIONS.CTE_READ), cteController.list);
// Download em lote (zip). Declarado antes de "/:id" para o segmento fixo
// "download-lote" não ser capturado como id.
cte.post(
  "/download-lote",
  requirePermission(PERMISSIONS.CTE_READ),
  cteController.baixarLote,
);
cte.get(
  "/:id/pdf",
  requirePermission(PERMISSIONS.CTE_READ),
  cteController.baixarPdf,
);
cte.get(
  "/:id/xml",
  requirePermission(PERMISSIONS.CTE_READ),
  cteController.baixarXml,
);
cte.get("/:id", requirePermission(PERMISSIONS.CTE_READ), cteController.get);
cte.post(
  "/",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.criar,
);
cte.put(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.atualizar,
);
cte.delete(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.remover,
);
cte.post(
  "/emitir",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.emitir,
);
cte.post(
  "/simular",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.simular,
);
cte.post(
  "/:id/emitir",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.emitirPorId,
);
cte.get(
  "/:id/status",
  requirePermission(PERMISSIONS.CTE_READ),
  cteController.consultarStatus,
);
cte.post(
  "/:id/cancelar",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.cancelar,
);
cte.patch(
  "/:id/manifesto",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.vincularManifesto,
);
router.use("/cte", cte);

// --------------------------------- MDF-e --------------------------------
const mdfe = Router();
mdfe.get("/", requirePermission(PERMISSIONS.MDFE_READ), mdfeController.list);
mdfe.get(
  "/reboques-preview",
  requirePermission(PERMISSIONS.MDFE_READ),
  mdfeController.previewReboques,
);
// Download em lote (zip). Antes de "/:id" para o segmento fixo não virar id.
mdfe.post(
  "/download-lote",
  requirePermission(PERMISSIONS.MDFE_READ),
  mdfeController.baixarLote,
);
mdfe.get(
  "/:id/pdf",
  requirePermission(PERMISSIONS.MDFE_READ),
  mdfeController.baixarPdf,
);
mdfe.get(
  "/:id/xml",
  requirePermission(PERMISSIONS.MDFE_READ),
  mdfeController.baixarXml,
);
mdfe.get("/:id", requirePermission(PERMISSIONS.MDFE_READ), mdfeController.get);
mdfe.post(
  "/",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.criar,
);
mdfe.put(
  "/:id",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.atualizar,
);
mdfe.delete(
  "/:id",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.remover,
);
mdfe.post(
  "/emitir",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.emitir,
);
mdfe.post(
  "/simular",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.simular,
);
mdfe.post(
  "/:id/emitir",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.emitirPorId,
);
mdfe.get(
  "/:id/status",
  requirePermission(PERMISSIONS.MDFE_READ),
  mdfeController.consultarStatus,
);
mdfe.post(
  "/:id/encerrar",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.encerrar,
);
mdfe.post(
  "/:id/cancelar",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.cancelar,
);
router.use("/mdfe", mdfe);

// Fluxo oficial: Contrato de Frete (operação) + CIOT vinculado.
// GET/POST /contratos-frete criam/listam a operação sem falar com a ANTT.
// POST /contratos-frete/:id/ciot registra o identificador no provedor.
const contratosFrete = Router();
contratosFrete.get(
  "/",
  requirePermission(PERMISSIONS.CIOT_READ),
  contratoFreteController.list,
);
contratosFrete.post(
  "/",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.create,
);
contratosFrete.post(
  "/simular",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  ciotController.simular,
);
contratosFrete.get(
  "/:id",
  requirePermission(PERMISSIONS.CIOT_READ),
  contratoFreteController.get,
);
contratosFrete.put(
  "/:id",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.update,
);
contratosFrete.post(
  "/:id/cancelar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.cancelar,
);
contratosFrete.post(
  "/:id/simular",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.simular,
);
contratosFrete.get(
  "/:id/ciot",
  requirePermission(PERMISSIONS.CIOT_READ),
  contratoFreteController.getCiot,
);
contratosFrete.post(
  "/:id/ciot",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.registrarCiot,
);
contratosFrete.post(
  "/:id/ciot/cancelar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.cancelarCiot,
);
contratosFrete.post(
  "/:id/ciot/encerrar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  contratoFreteController.encerrarCiot,
);
contratosFrete.get(
  "/:id/ciot/consultar",
  requirePermission(PERMISSIONS.CIOT_READ),
  contratoFreteController.consultarCiot,
);
router.use("/contratos-frete", contratosFrete);

// LEGADO / compatibilidade: /fiscal/ciot lista e opera sobre o CONTRATO de
// frete (não é mais a entidade da operação). Preferir /fiscal/contratos-frete.
// POST /ciot/declarar = criar contrato + registrar CIOT na mesma chamada.
// Não remover enquanto houver clientes/testes apontando para estas rotas.
const ciot = Router();
ciot.get("/", requirePermission(PERMISSIONS.CIOT_READ), ciotController.list);
ciot.post(
  "/simular",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  ciotController.simular,
);
ciot.post(
  "/consultar-situacao-transportador",
  requirePermission(PERMISSIONS.CIOT_READ),
  ciotController.consultarSituacaoTransportador,
);
ciot.get(
  "/:id",
  requirePermission(PERMISSIONS.CIOT_READ),
  ciotController.get,
);
ciot.get(
  "/:id/consultar-ciot-gerado",
  requirePermission(PERMISSIONS.CIOT_READ),
  ciotController.consultarCiotGerado,
);
ciot.post(
  "/declarar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  ciotController.declarar,
);
ciot.post(
  "/:id/cancelar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  ciotController.cancelar,
);
ciot.post(
  "/:id/encerrar",
  requirePermission(PERMISSIONS.CIOT_WRITE),
  ciotController.encerrar,
);
router.use("/ciot", ciot);

// ---------------------- Seguro / averbação ----------------------
const seguro = Router();
seguro.get(
  "/config",
  requireAnyFiscalRead,
  averbacaoController.getConfig,
);
seguro.put(
  "/config",
  requireAnyFiscalWrite,
  averbacaoController.saveConfig,
);
seguro.post(
  "/config/testar",
  requireAnyFiscalWrite,
  averbacaoController.testarConexao,
);
seguro.post(
  "/averbacoes",
  requireAnyFiscalWrite,
  averbacaoController.solicitar,
);
seguro.get(
  "/averbacoes/:id",
  requireAnyFiscalRead,
  averbacaoController.get,
);
seguro.post(
  "/averbacoes/:id/consultar",
  requireAnyFiscalRead,
  averbacaoController.consultar,
);
seguro.post(
  "/averbacoes/:id/reprocessar",
  requireAnyFiscalWrite,
  averbacaoController.reprocessar,
);
seguro.post(
  "/averbacoes/:id/cancelar",
  requireAnyFiscalWrite,
  averbacaoController.cancelar,
);
router.use("/seguro", seguro);

export default router;
