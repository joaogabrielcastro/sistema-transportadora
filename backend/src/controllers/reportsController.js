import { ReportsService } from "../services/ReportsService.js";
import { catchAsync } from "../utils/catchAsync.js";

// Função para converter datas dd/MM/yyyy para yyyy-MM-dd em query params
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
    const data = await ReportsService.getOverview();

    res.status(200).json({
      success: true,
      data,
    });
  }),

  getCostPerKm: catchAsync(async (req, res) => {
    converterDatasQuery(req.query);
    const data = await ReportsService.getCostPerKm({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      caminhaoId: req.query.caminhaoId,
    });
    res.status(200).json({
      success: true,
      data,
    });
  }),
};
