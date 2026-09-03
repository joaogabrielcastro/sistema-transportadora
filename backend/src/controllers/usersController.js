import { UserService } from "../services/UserService.js";
import {
  createUserSchema,
  updateUserSchema,
  inviteUserSchema,
} from "../schemas/userSchema.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";

export const usersController = {
  list: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const data = await UserService.list(tenantId);
    res.status(200).json({ success: true, data });
  }),

  create: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = createUserSchema.parse(req.body);
    const data = await UserService.create(
      tenantId,
      parsed,
      req.context.user.id,
    );
    res.status(201).json({
      success: true,
      data,
      message: "Usuário criado com sucesso",
    });
  }),

  invite: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = inviteUserSchema.parse(req.body);
    const data = await UserService.invite(
      tenantId,
      parsed,
      req.context.user.id,
    );
    res.status(201).json({
      success: true,
      data,
      message: `Convite enviado para ${data.email}`,
    });
  }),

  update: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const parsed = updateUserSchema.parse(req.body);
    const data = await UserService.update(
      tenantId,
      req.params.id,
      parsed,
      req.context.user.id,
    );
    res.status(200).json({
      success: true,
      data,
      message: "Usuário atualizado com sucesso",
    });
  }),
};
