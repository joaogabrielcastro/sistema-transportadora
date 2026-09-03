import { AuthService } from "../services/AuthService.js";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
  changePasswordSchema,
} from "../schemas/authSchema.js";
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

  forgotPassword: catchAsync(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await AuthService.requestPasswordReset(email);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  resetPassword: catchAsync(async (req, res) => {
    const parsed = resetPasswordSchema.parse(req.body);
    const result = await AuthService.resetPassword(parsed.token, parsed.password);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  getInvite: catchAsync(async (req, res) => {
    const token = String(req.query.token || "").trim();
    if (token.length < 16) {
      const err = new Error("Este convite expirou ou já foi usado.");
      err.statusCode = 400;
      throw err;
    }
    const data = await AuthService.getInvitePreview(token);
    res.status(200).json({ success: true, data });
  }),

  acceptInvite: catchAsync(async (req, res) => {
    const parsed = acceptInviteSchema.parse(req.body);
    const result = await AuthService.acceptInvite(parsed);
    res.status(200).json({
      success: true,
      data: result,
      message: "Convite aceito. Bem-vindo.",
    });
  }),

  changePassword: catchAsync(async (req, res) => {
    const parsed = changePasswordSchema.parse(req.body);
    const result = await AuthService.changePassword(req.context.user.id, parsed);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  }),

  me: catchAsync(async (req, res) => {
    const user = await AuthService.getProfile(
      req.context.user.id,
      req.context.user,
    );
    res.status(200).json({ success: true, data: user });
  }),
};
