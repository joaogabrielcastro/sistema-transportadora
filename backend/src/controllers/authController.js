import { AuthService } from "../services/AuthService.js";
import { loginSchema, registerSchema } from "../schemas/authSchema.js";
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

  register: catchAsync(async (req, res) => {
    const parsed = registerSchema.parse(req.body);
    const result = await AuthService.register({
      empresaNome: parsed.empresaNome,
      email: parsed.email,
      password: parsed.password,
      nome: parsed.nome || undefined,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: "Conta criada com sucesso",
    });
  }),

  me: catchAsync(async (req, res) => {
    const user = await AuthService.getProfile(req.context.user.id);
    res.status(200).json({ success: true, data: user });
  }),
};
