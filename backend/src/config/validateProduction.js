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

  if (!cfg.redis?.url) {
    warnings.push(
      "REDIS_URL não definido — fila de ordem de coleta fica em memória (jobs se perdem em restart/multi-réplica).",
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
