import { TenantService } from "../services/TenantService.js";
import {
  closeAccountSchema,
  updateTenantSettingsSchema,
} from "../schemas/tenantSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const tenantController = {
  getSettings: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await TenantService.getSettings(tenantId);
    res.json({ success: true, data });
  }),

  updateSettings: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const body = updateTenantSettingsSchema.parse(req.body);
    const data = await TenantService.updateSettings(tenantId, body);
    res.json({ success: true, data });
  }),

  closeAccount: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { confirmName } = closeAccountSchema.parse(req.body);
    const data = await TenantService.closeAccount(tenantId, {
      confirmName,
      actorUserId: req.context?.user?.id,
    });
    res.json({ success: true, data });
  }),
};
