import { Router } from "express";
import { viagensController as c } from "../controllers/viagensController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { uploadComprovante } from "../middleware/uploadComprovante.js";
import { PERMISSIONS as P } from "../utils/permissions.js";

/**
 * Viagens e operações. Toda rota exige viagens.read (ver a viagem) mais a
 * permissão da ação; campos financeiros são cortados no serviço conforme
 * viagens.financeiro.
 */
const router = Router();
const read = requirePermission(P.VIAGENS_READ);

router.get("/", read, c.list);
router.get("/resumo", read, c.resumo);
router.get("/relatorio", requirePermission(P.VIAGENS_READ, P.VIAGENS_REPORTS), c.relatorio);
router.post("/", requirePermission(P.VIAGENS_READ, P.VIAGENS_CREATE), c.create);
router.get("/:id", read, c.get);
router.patch("/:id", requirePermission(P.VIAGENS_READ, P.VIAGENS_EDIT), c.update);
router.post("/:id/iniciar", requirePermission(P.VIAGENS_READ, P.VIAGENS_START), c.start);
router.post("/:id/encerrar", requirePermission(P.VIAGENS_READ, P.VIAGENS_FINISH), c.finish);
router.post("/:id/cancelar", requirePermission(P.VIAGENS_READ, P.VIAGENS_EDIT), c.cancel);
router.get("/:id/historico", read, c.historico);

router.get("/:id/despesas", requirePermission(P.VIAGENS_READ, P.VIAGENS_DESPESAS_READ), c.listDespesas);
router.post(
  "/:id/despesas",
  requirePermission(P.VIAGENS_READ, P.VIAGENS_DESPESAS_CREATE),
  uploadComprovante,
  c.createDespesa,
);
router.patch(
  "/:id/despesas/:despesaId",
  requirePermission(P.VIAGENS_READ, P.VIAGENS_DESPESAS_EDIT),
  uploadComprovante,
  c.updateDespesa,
);
router.delete("/:id/despesas/:despesaId", requirePermission(P.VIAGENS_READ, P.VIAGENS_DESPESAS_DELETE), c.deleteDespesa);
router.get(
  "/:id/despesas/:despesaId/comprovante",
  requirePermission(P.VIAGENS_READ, P.VIAGENS_DESPESAS_READ),
  c.comprovante,
);

// Ids não numéricos viram 404 em vez de erro do banco.
router.param("id", (req, res, next, value) => {
  if (!/^\d+$/.test(String(value))) return res.status(404).json({ success: false, error: "Viagem não encontrada" });
  return next();
});
router.param("despesaId", (req, res, next, value) => {
  if (!/^\d+$/.test(String(value))) return res.status(404).json({ success: false, error: "Despesa não encontrada" });
  return next();
});

export default router;
