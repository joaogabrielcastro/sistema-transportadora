import { config } from "./index.js";

/**
 * Em produção exige API protegida. Falha no boot evita deploy acidental aberto.
 */
export function validateProductionConfig() {
  if (config.app.env !== "production") {
    return;
  }

  const errors = [];
  const warnings = [];

  if (!config.auth.enabled) {
    errors.push("AUTH_ENABLED=true é obrigatório em produção.");
  }

  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 16) {
    errors.push(
      "JWT_SECRET deve estar definido em produção (mínimo 16 caracteres).",
    );
  }

  if (!config.auth.apiToken) {
    warnings.push(
      "API_TOKEN não definido — opcional; use apenas para scripts/CI. O SPA usa login JWT.",
    );
  }

  if (!config.database.url) {
    errors.push("DATABASE_URL é obrigatório em produção.");
  }

  if (!process.env.CORS_ORIGINS?.trim()) {
    errors.push(
      "CORS_ORIGINS deve estar definido explicitamente em produção (ex.: https://abbroto.jwsoftware.com.br).",
    );
  }

  if (config.database.sslMode === "disable") {
    warnings.push(
      "DB_SSL_MODE=disable em produção — use require ou no-verify se o provedor exigir TLS.",
    );
  }

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
