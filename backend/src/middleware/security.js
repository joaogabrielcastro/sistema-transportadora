import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { resolveDefaultTenantId } from "../utils/tenant.js";

const SENSITIVE_KEY = /pass|password|token|secret|authorization|smtp/i;

let cachedDefaultTenantId = null;

async function getDefaultTenantId() {
  if (cachedDefaultTenantId != null) return cachedDefaultTenantId;

  const fromEnv = Number(process.env.DEFAULT_TENANT_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) {
    cachedDefaultTenantId = fromEnv;
    return cachedDefaultTenantId;
  }

  // Em testes sem DB, evita falha ao resolver seed tenant
  if (process.env.NODE_ENV === "test" && process.env.RUN_DB_TESTS !== "1" && process.env.CI !== "true") {
    cachedDefaultTenantId = 1;
    return cachedDefaultTenantId;
  }

  try {
    cachedDefaultTenantId = await resolveDefaultTenantId();
  } catch {
    cachedDefaultTenantId = 1;
  }
  return cachedDefaultTenantId;
}

const summarizeAuditBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const keys = Object.keys(body);
  if (keys.length === 0) return undefined;

  const summary = {};
  for (const key of keys) {
    if (SENSITIVE_KEY.test(key)) {
      summary[key] = "[redacted]";
    } else if (body[key] != null && typeof body[key] === "object") {
      summary[key] = "[object]";
    } else {
      summary[key] = body[key];
    }
  }
  return summary;
};

const tokensMatch = (provided, expected) => {
  if (!provided || !expected) {
    return false;
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
};

/** Exportado para testes unitários (sem depender do cache do config). */
export function verifyBearerToken(provided, expected) {
  return tokensMatch(provided, expected);
}

export const attachRequestContext = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  req.context = {
    requestId,
    user: {
      id: "anonymous",
      role: "viewer",
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

function applyAuthUser(req, user) {
  if (req.context?.user) {
    req.context.user = user;
  }
}

function applyJwtUser(req, jwtPayload) {
  const tenantId = Number(jwtPayload.tenantId);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return { ok: false, error: "Token sem tenant. Faça login novamente." };
  }

  applyAuthUser(req, {
    id: String(jwtPayload.sub),
    role: jwtPayload.role || "operator",
    email: jwtPayload.email,
    nome: jwtPayload.nome,
    tenantId,
  });
  return { ok: true };
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export const requireAuth = async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") {
      return next();
    }

    const token = readBearerToken(req);

    // Mesmo com AUTH_ENABLED=false: se o browser envia JWT (login/register),
    // respeita o tenantId do token. Evita vazamento: navbar de uma empresa
    // e dados do tenant seed (abbroto) quando auth está desligada em produção.
    if (!config.auth.enabled) {
      if (token) {
        const jwtPayload = verifyAccessToken(token);
        if (jwtPayload?.sub) {
          const applied = applyJwtUser(req, jwtPayload);
          if (!applied.ok) {
            return res.status(401).json({
              success: false,
              error: applied.error,
            });
          }
          return next();
        }
      }

      const tenantId = await getDefaultTenantId();
      applyAuthUser(req, {
        id: "dev",
        role: "admin",
        email: "dev@local",
        tenantId,
      });
      return next();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Não autorizado",
      });
    }

    const jwtPayload = verifyAccessToken(token);
    if (jwtPayload?.sub) {
      const applied = applyJwtUser(req, jwtPayload);
      if (!applied.ok) {
        return res.status(401).json({
          success: false,
          error: applied.error,
        });
      }
      return next();
    }

    if (tokensMatch(token, config.auth.apiToken)) {
      const tenantId = await getDefaultTenantId();
      applyAuthUser(req, {
        id: "api-token",
        role: "admin",
        email: "api-token",
        tenantId,
      });
      return next();
    }

    return res.status(401).json({
      success: false,
      error: "Não autorizado",
    });
  } catch (err) {
    return next(err);
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    const role = req.context?.user?.role || "viewer";
    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: "Sem permissão para esta operação",
      });
    }
    return next();
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
    tenantId: req.context?.user?.tenantId,
    method: req.method,
    path: req.path,
    bodyKeys:
      req.body && typeof req.body === "object" ? Object.keys(req.body) : null,
    bodySummary: summarizeAuditBody(req.body),
  });

  return next();
};
