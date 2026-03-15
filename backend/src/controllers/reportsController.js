import { ReportsService } from "../services/ReportsService.js";
import { catchAsync } from "../utils/catchAsync.js";

export const reportsController = {
  getOverview: catchAsync(async (req, res) => {
    const data = await ReportsService.getOverview();

    res.status(200).json({
      success: true,
      data,
    });
  }),

  getCostPerKm: catchAsync(async (req, res) => {
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
