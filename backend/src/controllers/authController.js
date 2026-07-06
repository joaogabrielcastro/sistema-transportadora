import { AuthService } from "../services/AuthService.js";
import { loginSchema } from "../schemas/authSchema.js";
import { catchAsync } from "../utils/catchAsync.js";

export const authController = {
  login: catchAsync(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await AuthService.login({ email, password });

    res.status(200).json({
      success: true,
      data: result,
      message: "Login realizado com sucesso",
    });
  }),

  me: catchAsync(async (req, res) => {
    const user = await AuthService.getProfile(req.context.user.id);
    res.status(200).json({ success: true, data: user });
  }),
};
