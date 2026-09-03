import { config } from "./index.js";

/**
 * Em produção exige API protegida. Falha no boot evita deploy acidental aberto.
 */
export function getProductionConfigErrors(cfg = config) {
  if (cfg.app.env !== "production") {
    return [];
  }

  const errors = [];

  if (!cfg.auth.enabled) {
    errors.push("AUTH_ENABLED=true é obrigatório em produção.");
  }

  if (!cfg.auth.jwtSecret || cfg.auth.jwtSecret.length < 16) {
    errors.push(
      "JWT_SECRET deve estar definido em produção (mínimo 16 caracteres).",
    );
  }

  if (!cfg.database.url) {
    errors.push("DATABASE_URL é obrigatório em produção.");
  }

  if (!process.env.CORS_ORIGINS?.trim()) {
    errors.push(
      "CORS_ORIGINS deve estar definido explicitamente em produção (ex.: https://abbroto.jwsoftware.com.br).",
    );
  }

  if (!cfg.redis?.url) {
    errors.push(
      "REDIS_URL é obrigatório em produção (fila durable de PDF/e-mail).",
    );
  }

  return errors;
}

export function getProductionConfigWarnings(cfg = config) {
  if (cfg.app.env !== "production") {
    return [];
  }

  const warnings = [];

  if (!cfg.auth.apiToken) {
    warnings.push(
      "API_TOKEN não definido — opcional; use apenas para scripts/CI. O SPA usa login JWT.",
    );
  }

  if (cfg.database.sslMode === "disable") {
    warnings.push(
      "DB_SSL_MODE=disable em produção — use require ou no-verify se o provedor exigir TLS.",
    );
  }

  if (!cfg.storage?.s3Enabled) {
    warnings.push(
      "S3 não configurado — uploads ficam só no disco local (monte volume /app/uploads).",
    );
  }

  if (cfg.workers?.runInApiProcess === false) {
    warnings.push(
      "Worker de ordem de coleta DESLIGADO na API (RUN_ORDEM_WORKER_IN_API=false) — rode scripts/worker-ordem-coleta.mjs ou os envios ficam em Processando… para sempre.",
    );
  } else if (cfg.workers?.runInApiProcess) {
    warnings.push(
      "Worker de PDF rodando na API — em escala horizontal use scripts/worker-ordem-coleta.mjs e RUN_ORDEM_WORKER_IN_API=false.",
    );
  }

  const mail = cfg.mail || {};
  const mailFrom = String(mail.mailFrom || mail.smtpUser || "").trim();
  if (!String(mail.smtpHost || "").trim() || !Number(mail.smtpPort) || !mailFrom) {
    warnings.push(
      "SMTP não configurado — recuperação de senha, convite e e-mail de ordem de coleta não funcionam. Defina SMTP_HOST, SMTP_PORT, MAIL_FROM e credenciais.",
    );
  }

  if (!(process.env.SENTRY_DSN || "").trim()) {
    warnings.push(
      "SENTRY_DSN não definido — erros 500 da API não vão para o Sentry.",
    );
  }

  const backupOn = ["1", "true", "yes", "on"].includes(
    String(process.env.BACKUP_ENABLED || "").toLowerCase(),
  );
  if (!backupOn) {
    warnings.push(
      "BACKUP_ENABLED não está true — ative o dump diário na API ou agende npm run db:backup no Coolify.",
    );
  }

  return warnings;
}

export function validateProductionConfig() {
  const errors = getProductionConfigErrors();
  const warnings = getProductionConfigWarnings();

  if (warnings.length > 0) {
    console.warn("[boot] Avisos de produção:");
    for (const line of warnings) {
      console.warn(`  - ${line}`);
    }
  }

  if (errors.length > 0) {
    console.error("[boot] Configuração de produção inválida:");
    for (const line of errors) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }
}
