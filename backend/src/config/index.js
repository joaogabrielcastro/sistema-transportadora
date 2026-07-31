// backend/src/config/index.js
import "dotenv/config";

const parseCsv = (value, fallback = []) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) =>
      entry
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\/$/, ""),
    )
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
    port: Number(process.env.PORT) || 3020,
    env: process.env.NODE_ENV || "development",
    corsOrigins: parseCsv(process.env.CORS_ORIGINS, [
      "https://abbroto.jwsoftware.com.br",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3011",
      "http://localhost:3020",
    ]),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY, 1),
  },
  auth: {
    get enabled() {
      return parseBoolean(process.env.AUTH_ENABLED, false);
    },
    get apiToken() {
      return process.env.API_TOKEN || "";
    },
    get jwtSecret() {
      return process.env.JWT_SECRET || process.env.API_TOKEN || "";
    },
    get jwtExpiresIn() {
      return process.env.JWT_EXPIRES_IN || "7d";
    },
    get defaultTenantId() {
      return process.env.DEFAULT_TENANT_ID
        ? Number(process.env.DEFAULT_TENANT_ID)
        : null;
    },
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
  mail: {
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 0) || 0,
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    mailFrom: process.env.MAIL_FROM || "",
  },
  redis: {
    /** URL completa, ex.: redis://default:senha@host:6379/0 */
    url: (process.env.REDIS_URL || "").trim() || null,
  },
};
