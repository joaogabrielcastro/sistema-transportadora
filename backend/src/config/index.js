// backend/src/config/index.js
import "dotenv/config";

const parseCsv = (value, fallback = []) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const parseTrustProxy = (value, fallback = 1) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).toLowerCase().trim();

  if (["true", "yes", "on"].includes(normalized)) {
    return 1;
  }

  if (["false", "no", "off"].includes(normalized)) {
    return 0;
  }

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return value;
};

export const config = {
  database: {
    url: process.env.DATABASE_URL,
    sslMode: process.env.DB_SSL_MODE || "auto",
  },
  app: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || "development",
    corsOrigins: parseCsv(process.env.CORS_ORIGINS, [
      "https://abbroto.jwsoftware.com.br",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3011",
    ]),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY, 1),
  },
  auth: {
    enabled: parseBoolean(process.env.AUTH_ENABLED, false),
    apiToken: process.env.API_TOKEN || "",
    adminRoles: parseCsv(process.env.ADMIN_ROLES, ["admin", "owner"]),
  },
  security: {
    rateLimitWindowMs: Number(
      process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
    ),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    // Em produção (Coolify/Docker), logs no stdout são essenciais para debugar 500s.
    // Pode ser desabilitado explicitamente com LOG_CONSOLE=false.
    enableConsole: parseBoolean(process.env.LOG_CONSOLE, true),
  },
};
