import { hasPermission } from "../utils/permissions.js";

/**
 * Exige permissão(ões). Admin via role já tem todas no resolvePermissions.
 * @param {string | string[]} required
 */
export const requirePermission =
  (...required) =>
  (req, res, next) => {
    const perms = req.context?.user?.permissions || [];
    const flat = required.flat();
    if (!hasPermission(perms, flat)) {
      return res.status(403).json({
        success: false,
        error: "Sem permissão para esta operação",
        required: flat,
      });
    }
    return next();
  };
