import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const attachRequestContext = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const userId = req.headers["x-user-id"] || "anonymous";
  const role = req.headers["x-user-role"] || "viewer";

  req.context = {
    requestId,
    user: {
      id: userId,
      role,
    },
  };

  res.setHeader("x-request-id", requestId);
  next();
};

export const apiRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Muitas requisições. Tente novamente em alguns minutos.",
  },
});

export const requireAuth = (req, res, next) => {
  if (!config.auth.enabled) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token || token !== config.auth.apiToken) {
    return res.status(401).json({
      success: false,
      error: "Não autorizado",
    });
  }

  return next();
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!config.auth.enabled) {
      return next();
    }

    const role = req.context?.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Você não possui permissão para esta ação.",
      });
    }

    return next();
  };
};

export const auditLog = (req, res, next) => {
  const method = req.method.toUpperCase();
  const shouldAudit = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (!shouldAudit) {
    return next();
  }

  logger.info("Audit log", {
    requestId: req.context?.requestId,
    userId: req.context?.user?.id,
    role: req.context?.user?.role,
    method: req.method,
    path: req.path,
    body: req.body,
  });

  return next();
};