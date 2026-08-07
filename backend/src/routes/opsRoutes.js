import { Router } from "express";
import { opsController } from "../controllers/opsController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/security.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/alerts",
  requirePermission(PERMISSIONS.ALERTS_READ),
  opsController.alerts,
);
router.get(
  "/documentos",
  requirePermission(PERMISSIONS.DOCS_READ),
  opsController.documentsCockpit,
);
router.get("/onboarding", opsController.onboardingStatus);
router.post(
  "/onboarding/complete",
  requireRole("admin"),
  opsController.onboardingComplete,
);
router.patch(
  "/settings",
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  opsController.tenantSettings,
);
router.get(
  "/audit-logs",
  requirePermission(PERMISSIONS.AUDIT_READ),
  opsController.auditLogs,
);
router.post(
  "/digest/send",
  requireRole("admin"),
  opsController.sendDigestNow,
);
router.post(
  "/whatsapp/test",
  requireRole("admin"),
  opsController.whatsappTest,
);

export default router;
