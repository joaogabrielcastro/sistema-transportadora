import { AlertsService } from "../services/AlertsService.js";
import { OnboardingService } from "../services/OnboardingService.js";
import { AuditService } from "../services/AuditService.js";
import { DigestService } from "../services/DigestService.js";
import { WhatsAppService } from "../services/WhatsAppService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const opsController = {
  alerts: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await AlertsService.listForTenant(tenantId);
    res.json({ success: true, data });
  }),

  documentsCockpit: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await AlertsService.documentsCockpit(tenantId);
    res.json({ success: true, data });
  }),

  onboardingStatus: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await OnboardingService.getStatus(tenantId);
    res.json({ success: true, data });
  }),

  onboardingComplete: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await OnboardingService.complete(tenantId);
    res.json({ success: true, data });
  }),

  tenantSettings: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await OnboardingService.updateSettings(tenantId, req.body);
    res.json({ success: true, data });
  }),

  auditLogs: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await AuditService.list(tenantId, {
      limit: req.query.limit,
      offset: req.query.offset,
      userEmail: req.query.userEmail || req.query.email,
      action: req.query.action,
      q: req.query.q || req.query.path,
    });
    res.json({ success: true, data });
  }),

  sendDigestNow: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const prisma = (await import("../lib/prisma.js")).default;
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    const data = await DigestService.sendWeeklyForTenant(tenant);
    res.json({ success: true, data });
  }),

  whatsappTest: catchAsync(async (req, res) => {
    const to = req.body?.to;
    const body = req.body?.body || "Teste ATrack WhatsApp";
    const data = await WhatsAppService.sendText({ to, body });
    res.json({ success: true, data });
  }),
};
