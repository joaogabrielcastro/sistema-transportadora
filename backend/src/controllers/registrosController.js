import { RegistrosService } from "../services/RegistrosService.js";
import { registrosListSchema } from "../schemas/authSchema.js";
import { catchAsync } from "../utils/catchAsync.js";

export const registrosController = {
  list: catchAsync(async (req, res) => {
    const params = registrosListSchema.parse(req.query);
    const result = await RegistrosService.list(params);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),
};
