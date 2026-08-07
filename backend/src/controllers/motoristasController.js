import { MotoristaService } from "../services/MotoristaService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const motoristasController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const ativo =
      req.query.ativo === "true"
        ? true
        : req.query.ativo === "false"
          ? false
          : undefined;
    const data = await MotoristaService.list(tenantId, {
      q: req.query.q,
      ativo,
    });
    res.json({ success: true, data });
  }),

  get: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await MotoristaService.getById(tenantId, req.params.id);
    res.json({ success: true, data });
  }),

  create: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await MotoristaService.create(tenantId, req.body);
    res.status(201).json({ success: true, data });
  }),

  update: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await MotoristaService.update(
      tenantId,
      req.params.id,
      req.body,
    );
    res.json({ success: true, data });
  }),

  remove: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await MotoristaService.remove(tenantId, req.params.id);
    res.json({ success: true, data });
  }),
};
