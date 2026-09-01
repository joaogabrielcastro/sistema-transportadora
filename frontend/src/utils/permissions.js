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
  // Módulo fiscal de transporte (CT-e / MDF-e / CIOT) — espelha o backend.
  CTE_READ: "cte.read",
  CTE_WRITE: "cte.write",
  MDFE_READ: "mdfe.read",
  MDFE_WRITE: "mdfe.write",
  CIOT_READ: "ciot.read",
  CIOT_WRITE: "ciot.write",
});

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
