import { ReportsService } from "../services/ReportsService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { costPerKmQuerySchema } from "../schemas/reportsSchema.js";
import { requireTenantId } from "../utils/tenant.js";

function converterDatasQuery(query) {
  const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  for (const key in query) {
    if (
      key.toLowerCase().includes("date") &&
      typeof query[key] === "string" &&
      dataRegex.test(query[key])
    ) {
      const [dia, mes, ano] = query[key].split("/");
      query[key] = `${ano}-${mes}-${dia}`;
    }
  }
  return query;
}

export const reportsController = {
  getOverview: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await ReportsService.getOverview(tenantId);

    res.status(200).json({
      success: true,
      data,
    });
  }),

  getCostPerKm: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    converterDatasQuery(req.query);
    const parsed = costPerKmQuerySchema.parse(req.query);
    const data = await ReportsService.getCostPerKm(tenantId, parsed);
    res.status(200).json({
      success: true,
      data,
    });
  }),
};
