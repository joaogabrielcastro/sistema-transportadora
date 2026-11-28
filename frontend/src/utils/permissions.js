/**
 * Helpers de permissão no cliente (espelham o catálogo do backend).
 */
export const PERMISSIONS = Object.freeze({
  FROTA_READ: "frota.read",
  FROTA_WRITE: "frota.write",
  GASTOS_WRITE: "gastos.write",
  PNEUS_WRITE: "pneus.write",
  DOCS_WRITE: "docs.write",
  DOCS_READ: "docs.read",
  MOTORISTAS_WRITE: "motoristas.write",
  MOTORISTAS_READ: "motoristas.read",
  ORDEM_SEND: "ordem.send",
  NOTAS_READ: "notas.read",
  NOTAS_WRITE: "notas.write",
  REPORTS_READ: "reports.read",
  USERS_MANAGE: "users.manage",
  BILLING_MANAGE: "billing.manage",
  AUDIT_READ: "audit.read",
  ALERTS_READ: "alerts.read",
  SETTINGS_WRITE: "settings.write",
  // Módulo fiscal de transporte (CT-e / MDF-e / Contrato de Frete / CIOT) — espelha o backend.
  CTE_READ: "cte.read",
  CTE_WRITE: "cte.write",
  MDFE_READ: "mdfe.read",
  MDFE_WRITE: "mdfe.write",
  // Contrato de Frete e CIOT usam as mesmas chaves (não quebrar extras já gravados).
  CIOT_READ: "ciot.read",
  CIOT_WRITE: "ciot.write",
  // Telemetria (add-on). Também exige feature `telemetria` no tenant.
  TELEMETRY_READ: "telemetry.read",
  TELEMETRY_WRITE: "telemetry.write",
  // Valores de gastos da frota; o admin pode revogar por usuário.
  GASTOS_READ: "gastos.read",
  // Controle de viagens e operações.
  VIAGENS_READ: "viagens.read",
  VIAGENS_CREATE: "viagens.create",
  VIAGENS_START: "viagens.start",
  VIAGENS_FINISH: "viagens.finish",
  VIAGENS_EDIT: "viagens.edit",
  VIAGENS_DESPESAS_READ: "viagens.despesas.read",
  VIAGENS_DESPESAS_CREATE: "viagens.despesas.create",
  VIAGENS_DESPESAS_EDIT: "viagens.despesas.edit",
  VIAGENS_DESPESAS_DELETE: "viagens.despesas.delete",
  VIAGENS_FINANCEIRO: "viagens.financeiro",
  VIAGENS_REPORTS: "viagens.reports",
});

/**
 * Permissões ajustáveis por usuário (tela Usuários → Permissões), em grupos.
 * Espelha CONFIGURABLE_PERMISSIONS do backend.
 */
export const PERMISSION_GROUPS = Object.freeze([
  {
    id: "viagens",
    label: "Viagens",
    items: [
      { key: "viagens.read", label: "Visualizar viagens" },
      { key: "viagens.create", label: "Criar viagens" },
      { key: "viagens.start", label: "Iniciar viagens" },
      { key: "viagens.finish", label: "Encerrar viagens" },
      { key: "viagens.edit", label: "Editar e cancelar viagens" },
    ],
  },
  {
    id: "despesas",
    label: "Despesas da viagem",
    items: [
      { key: "viagens.despesas.read", label: "Visualizar despesas" },
      { key: "viagens.despesas.create", label: "Registrar despesas" },
      { key: "viagens.despesas.edit", label: "Editar despesas" },
      { key: "viagens.despesas.delete", label: "Excluir despesas" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro e relatórios",
    items: [
      { key: "viagens.financeiro", label: "Ver valores das viagens (R$, custo por km)" },
      { key: "viagens.reports", label: "Relatório de viagens" },
      { key: "gastos.read", label: "Ver gastos da frota (Manutenção e gastos)" },
      { key: "reports.read", label: "Relatórios gerais de custo" },
    ],
  },
]);

/**
 * @param {{ permissions?: string[], role?: string } | null | undefined} user
 * @param {string | string[]} required
 */
export function userHasPermission(user, required) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const list = Array.isArray(required) ? required : [required];
  const set = new Set(user.permissions || []);
  return list.every((p) => set.has(p));
}
