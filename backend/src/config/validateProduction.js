import { config } from "./index.js";

/**
 * Em produção exige API protegida. Falha no boot evita deploy acidental aberto.
 */
export function validateProductionConfig() {
  if (config.app.env !== "production") {
    return;
  }

  const errors = [];

  if (!config.auth.enabled) {
    errors.push("AUTH_ENABLED=true é obrigatório em produção.");
  }

  if (!config.auth.apiToken || config.auth.apiToken.length < 16) {
    errors.push(
      "API_TOKEN deve estar definido em produção (mínimo 16 caracteres).",
    );
  }

  if (!config.database.url) {
    errors.push("DATABASE_URL é obrigatório em produção.");
  }

  if (errors.length > 0) {
    console.error("[boot] Configuração de produção inválida:");
    for (const line of errors) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }
}
