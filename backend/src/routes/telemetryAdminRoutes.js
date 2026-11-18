import { Router } from "express";
import { telemetryAdminController } from "../controllers/telemetryAdminController.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/security.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = Router();

router.get(
  "/devices",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.listDevices,
);
router.get(
  "/devices/:id",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.getDevice,
);
router.post(
  "/devices",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.createDevice,
);
router.patch(
  "/devices/:id",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.updateDevice,
);
router.post(
  "/devices/:id/assign",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.assignDevice,
);
router.post(
  "/devices/:id/unassign",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.unassignDevice,
);
router.post(
  "/devices/:id/revoke",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.revokeDevice,
);
router.post(
  "/devices/:id/rotate-credential",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.rotateCredential,
);

router.get(
  "/current",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.current,
);
router.get(
  "/history",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.history,
);

router.get(
  "/geofences",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.listGeofences,
);
router.post(
  "/geofences",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.createGeofence,
);
router.patch(
  "/geofences/:id",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.updateGeofence,
);
router.delete(
  "/geofences/:id",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.deleteGeofence,
);

router.get(
  "/alerts",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.listAlerts,
);
router.post(
  "/alerts/:id/resolve",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.resolveAlert,
);

router.get(
  "/alert-rules",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.listAlertRules,
);
router.post(
  "/alert-rules",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  telemetryAdminController.upsertAlertRule,
);

router.get(
  "/subscription",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.getSubscription,
);
// Plano, quantidade de veículos e mensalidade são dados comerciais:
// só administradores alteram (operadores têm telemetry.write por padrão).
router.put(
  "/subscription",
  requirePermission(PERMISSIONS.TELEMETRY_WRITE),
  requireRole("admin"),
  telemetryAdminController.upsertSubscription,
);

router.get(
  "/reports/efficiency",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.efficiency,
);

router.get(
  "/protocols",
  requirePermission(PERMISSIONS.TELEMETRY_READ),
  telemetryAdminController.protocols,
);

export default router;
