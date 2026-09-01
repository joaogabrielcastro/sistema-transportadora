import { Router } from "express";
import { requirePermission } from "../middleware/requirePermission.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  fiscalEmpresasController,
  fiscalClientesController,
  fiscalVeiculoDadosController,
  cteController,
  mdfeController,
  ciotController,
} from "../controllers/fiscalController.js";

// Montado em app.js como:
//   apiRouter.use("/fiscal", requireFeature("transporte_fiscal"), fiscalRoutes)
// -> requireAuth + requireActiveSubscription + auditLog já aplicados antes.
const router = Router();

// --- Cadastros de apoio (empresa emissora, cliente/tomador, dados fiscais do veículo) ---
// Leitura: qualquer permissão de leitura fiscal serve. Escrita: CTE_WRITE (cadastro base).
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

const empresas = Router();
empresas.get("/", requireAnyFiscalRead, fiscalEmpresasController.list);
empresas.get("/:id", requireAnyFiscalRead, fiscalEmpresasController.get);
empresas.post(
  "/",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalEmpresasController.create,
);
empresas.put(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
  fiscalEmpresasController.update,
);
empresas.delete(
  "/:id",
  requirePermission(PERMISSIONS.CTE_WRITE),
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
cte.get("/:id", requirePermission(PERMISSIONS.CTE_READ), cteController.get);
cte.post(
  "/emitir",
  requirePermission(PERMISSIONS.CTE_WRITE),
  cteController.emitir,
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
mdfe.get("/:id", requirePermission(PERMISSIONS.MDFE_READ), mdfeController.get);
mdfe.post(
  "/emitir",
  requirePermission(PERMISSIONS.MDFE_WRITE),
  mdfeController.emitir,
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

// --------------------------------- CIOT ---------------------------------
const ciot = Router();
ciot.get("/", requirePermission(PERMISSIONS.CIOT_READ), ciotController.list);
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

export default router;
