import {
  alertRuleBodySchema,
  assignTelemetryDeviceBodySchema,
  createTelemetryDeviceBodySchema,
  efficiencyQuerySchema,
  drivingReportQuerySchema,
  deviceCommandBodySchema,
  deviceCommandQuerySchema,
  geofenceBodySchema,
  geofenceUpdateBodySchema,
  rotateCredentialBodySchema,
  subscriptionBodySchema,
  telemetryCurrentQuerySchema,
  telemetryHistoryQuerySchema,
  updateTelemetryDeviceBodySchema,
} from "../schemas/telemetryAdminSchema.js";
import {
  assignDeviceForTenant,
  createTelemetryDeviceForTenant,
  getTelemetryDevice,
  listCurrentStates,
  listHistory,
  listTelemetryDevices,
  revokeDeviceForTenant,
  rotateCredentialForTenant,
  unassignDeviceForTenant,
  updateTelemetryDeviceForTenant,
} from "../services/telemetry/telemetryDeviceAdmin.js";
import {
  createGeofence,
  deleteGeofence,
  efficiencyReport,
  getSubscription,
  listAlertRules,
  listAlerts,
  listGeofences,
  resolveAlert,
  updateGeofence,
  upsertAlertRule,
  upsertSubscription,
} from "../services/telemetry/telemetryOpsAdmin.js";
import {
  createDeviceCommand,
  listDeviceCommands,
} from "../services/telemetry/telemetryCommands.js";
import { listSupportedProtocols } from "../services/telemetry/protocols/registry.js";
import { drivingReport } from "../services/telemetry/telemetryDrivingAdmin.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const telemetryAdminController = {
  listDevices: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const ativo =
      req.query.ativo === "true"
        ? true
        : req.query.ativo === "false"
          ? false
          : undefined;
    const data = await listTelemetryDevices(tenantId, { ativo });
    res.json({ success: true, data });
  }),

  getDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await getTelemetryDevice(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  createDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = createTelemetryDeviceBodySchema.parse(req.body);
    const data = await createTelemetryDeviceForTenant(tenantId, body);
    res.status(201).json({ success: true, data });
  }),

  updateDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = updateTelemetryDeviceBodySchema.parse(req.body);
    const data = await updateTelemetryDeviceForTenant(
      tenantId,
      req.params.id,
      body,
    );
    res.json({ success: true, data });
  }),

  assignDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = assignTelemetryDeviceBodySchema.parse(req.body);
    const data = await assignDeviceForTenant(tenantId, req.params.id, body);
    res.json({ success: true, data });
  }),

  unassignDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await unassignDeviceForTenant(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  revokeDevice: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await revokeDeviceForTenant(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  rotateCredential: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = rotateCredentialBodySchema.parse(req.body ?? {});
    const data = await rotateCredentialForTenant(tenantId, req.params.id, body);
    res.json({ success: true, data });
  }),

  current: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const query = telemetryCurrentQuerySchema.parse(req.query);
    const data = await listCurrentStates(tenantId, {
      caminhaoId: query.caminhao_id,
    });
    res.json({ success: true, data });
  }),

  history: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const query = telemetryHistoryQuerySchema.parse(req.query);
    const data = await listHistory(tenantId, {
      caminhaoId: query.caminhao_id,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    res.json({ success: true, data });
  }),

  listGeofences: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({ success: true, data: await listGeofences(tenantId) });
  }),

  createGeofence: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = geofenceBodySchema.parse(req.body);
    const data = await createGeofence(tenantId, body);
    res.status(201).json({ success: true, data });
  }),

  updateGeofence: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = geofenceUpdateBodySchema.parse(req.body);
    const data = await updateGeofence(tenantId, req.params.id, body);
    res.json({ success: true, data });
  }),

  deleteGeofence: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await deleteGeofence(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  listAlerts: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await listAlerts(tenantId, {
      status: req.query.status,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  }),

  resolveAlert: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await resolveAlert(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  listAlertRules: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({ success: true, data: await listAlertRules(tenantId) });
  }),

  upsertAlertRule: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = alertRuleBodySchema.parse(req.body);
    const data = await upsertAlertRule(tenantId, body);
    res.json({ success: true, data });
  }),

  getSubscription: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    res.json({ success: true, data: await getSubscription(tenantId) });
  }),

  upsertSubscription: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = subscriptionBodySchema.parse(req.body);
    const data = await upsertSubscription(tenantId, body);
    res.json({ success: true, data });
  }),

  efficiency: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const query = efficiencyQuerySchema.parse(req.query);
    const data = await efficiencyReport(tenantId, query);
    res.json({ success: true, data });
  }),

  driving: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const q = drivingReportQuerySchema.parse(req.query);
    const data = await drivingReport(tenantId, {
      from: q.from,
      to: q.to,
      caminhaoId: q.caminhao_id,
      motoristaId: q.motorista_id,
      limit: q.limit,
    });
    res.json({ success: true, data });
  }),

  createCommand: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = deviceCommandBodySchema.parse(req.body);
    const data = await createDeviceCommand(tenantId, req.context?.user?.id ?? null, {
      caminhaoId: body.caminhao_id,
      acao: body.acao,
    });
    res.status(201).json({ success: true, data });
  }),

  listCommands: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const q = deviceCommandQuerySchema.parse(req.query);
    const data = await listDeviceCommands(tenantId, { caminhaoId: q.caminhao_id, limit: q.limit });
    res.json({ success: true, data });
  }),

  protocols: catchAsync(async (_req, res) => {
    res.json({ success: true, data: listSupportedProtocols() });
  }),
};
