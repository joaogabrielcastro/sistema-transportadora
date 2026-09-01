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
  billing: {
    get stripeSecretKey() {
      return (process.env.STRIPE_SECRET_KEY || "").trim();
    },
    get stripeWebhookSecret() {
      return (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    },
    get frontendUrl() {
      return (
        (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "") ||
        "http://localhost:5173"
      );
    },
    get trialDays() {
      const n = Number(process.env.BILLING_TRIAL_DAYS || 14);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
    },
    get prices() {
      return {
        starter: (process.env.STRIPE_PRICE_STARTER || "").trim(),
        ops: (process.env.STRIPE_PRICE_OPS || "").trim(),
        fiscal: (process.env.STRIPE_PRICE_FISCAL || "").trim(),
        complete: (process.env.STRIPE_PRICE_COMPLETE || "").trim(),
      };
    },
    get enabled() {
      return Boolean((process.env.STRIPE_SECRET_KEY || "").trim());
    },
  },
  storage: {
    get s3Enabled() {
      return Boolean(
        (process.env.S3_BUCKET || "").trim() &&
          (process.env.S3_ACCESS_KEY_ID || "").trim() &&
          (process.env.S3_SECRET_ACCESS_KEY || "").trim(),
      );
    },
    get bucket() {
      return (process.env.S3_BUCKET || "").trim();
    },
    get region() {
      return (process.env.S3_REGION || "auto").trim();
    },
    get endpoint() {
      return (process.env.S3_ENDPOINT || "").trim() || null;
    },
    get accessKeyId() {
      return (process.env.S3_ACCESS_KEY_ID || "").trim();
    },
    get secretAccessKey() {
      return (process.env.S3_SECRET_ACCESS_KEY || "").trim();
    },
  },
  fiscal: {
    /** Chave para cifrar token/senha do certificado (AES-256-GCM). Sem ela, gravar segredo fiscal falha com 503. */
    get secretsKey() {
      return (process.env.FISCAL_SECRETS_KEY || "").trim();
    },
    /** 1 = produção, 2 = homologação. Fixo em homologação salvo FISCAL_AMBIENTE=producao. Nunca vem do body. */
    get ambiente() {
      return String(process.env.FISCAL_AMBIENTE || "").trim().toLowerCase() ===
        "producao"
        ? 1
        : 2;
    },
    /** Base URL do provedor de CT-e/MDF-e. Provedor ainda não decidido — sem default de fornecedor; obrigatória para emitir. */
    get cteMdfeBaseUrl() {
      return (process.env.FISCAL_CTE_MDFE_URL || "").trim().replace(/\/$/, "");
    },
    /** Base URL do provedor de CIOT (integração direta ANTT ou integrador). Sem default de fornecedor; obrigatória para declarar. */
    get ciotBaseUrl() {
      return (process.env.FISCAL_CIOT_URL || "").trim().replace(/\/$/, "");
    },
    get httpTimeoutMs() {
      const n = Number(process.env.FISCAL_HTTP_TIMEOUT_MS || 30000);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30000;
    },
  },
  whatsapp: {
    get apiUrl() {
      return (process.env.WHATSAPP_API_URL || "").trim();
    },
    get token() {
      return (process.env.WHATSAPP_TOKEN || "").trim();
    },
    get from() {
      return (process.env.WHATSAPP_FROM || "").trim();
    },
  },
  workers: {
    get runInApiProcess() {
      // Default: worker na própria API (Coolify 1 serviço).
      // Só desliga com RUN_ORDEM_WORKER_IN_API=false + processo worker separado.
      if (process.env.RUN_ORDEM_WORKER_IN_API === "false") return false;
      if (process.env.RUN_ORDEM_WORKER_IN_API === "true") return true;
      return true;
    },
  },
};
