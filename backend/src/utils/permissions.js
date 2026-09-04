/** RBAC: permissões por role + extras no usuário. */

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
  // Módulo fiscal de transporte (CT-e / MDF-e / CIOT).
  // Ficam de fora de OPERATOR_PERMS por padrão: cada tenant decide depois se
  // libera para operator via users.permissions.
  CTE_READ: "cte.read",
  CTE_WRITE: "cte.write",
  MDFE_READ: "mdfe.read",
  MDFE_WRITE: "mdfe.write",
  CIOT_READ: "ciot.read",
  CIOT_WRITE: "ciot.write",
});

const ALL = Object.values(PERMISSIONS);

const OPERATOR_PERMS = [
  PERMISSIONS.FROTA_READ,
  PERMISSIONS.FROTA_WRITE,
  PERMISSIONS.GASTOS_WRITE,
  PERMISSIONS.PNEUS_WRITE,
  PERMISSIONS.DOCS_READ,
  PERMISSIONS.DOCS_WRITE,
  PERMISSIONS.MOTORISTAS_READ,
  PERMISSIONS.MOTORISTAS_WRITE,
  PERMISSIONS.ORDEM_SEND,
  PERMISSIONS.NOTAS_READ,
  PERMISSIONS.NOTAS_WRITE,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.ALERTS_READ,
];

const ROLE_PERMISSIONS = Object.freeze({
  admin: ALL,
  operator: OPERATOR_PERMS,
  viewer: [
    PERMISSIONS.FROTA_READ,
    PERMISSIONS.DOCS_READ,
    PERMISSIONS.MOTORISTAS_READ,
    PERMISSIONS.NOTAS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.ALERTS_READ,
  ],
});

/**
 * @param {string} role
 * @param {unknown} extraPermissions
 * @returns {string[]}
 */
export function resolvePermissions(role, extraPermissions = []) {
  const base = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.operator;
  const extras = Array.isArray(extraPermissions)
    ? extraPermissions.filter((p) => typeof p === "string")
    : [];
  return [...new Set([...base, ...extras])];
}

/**
 * @param {string[]} userPerms
 * @param {string | string[]} required
 */
export function hasPermission(userPerms, required) {
  const list = Array.isArray(required) ? required : [required];
  const set = new Set(userPerms || []);
  return list.every((p) => set.has(p));
}

const KNOWN_ROLES = new Set(["admin", "operator", "viewer"]);

/** Persist only catalog roles; anything else becomes operator. */
export function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return KNOWN_ROLES.has(value) ? value : "operator";
}
