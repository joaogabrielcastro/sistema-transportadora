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
  // Módulo fiscal de transporte (CT-e / MDF-e / Contrato de Frete / CIOT).
  // Ficam de fora de OPERATOR_PERMS por padrão: cada tenant decide depois se
  // libera para operator via users.permissions.
  CTE_READ: "cte.read",
  CTE_WRITE: "cte.write",
  MDFE_READ: "mdfe.read",
  MDFE_WRITE: "mdfe.write",
  // Contrato de Frete e CIOT compartilham ciot.read/ciot.write de propósito:
  // separar em contrato_frete.read/write exigiria migração dos extras em users.
  CIOT_READ: "ciot.read",
  CIOT_WRITE: "ciot.write",
  // Telemetria (add-on). Também exige feature `telemetria` no tenant.
  TELEMETRY_READ: "telemetry.read",
  TELEMETRY_WRITE: "telemetry.write",
  // Valores de gastos da frota (lista, consumo). Todo perfil tem por padrão;
  // o admin pode revogar por usuário (ex.: motorista sem acesso a valores).
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
  /** Valores em R$ das viagens: valor da despesa, total, custo por km. */
  VIAGENS_FINANCEIRO: "viagens.financeiro",
  VIAGENS_REPORTS: "viagens.reports",
});

/**
 * Permissões que o administrador pode ligar/desligar por usuário na tela de
 * Usuários. As demais seguem só o perfil (role).
 */
export const CONFIGURABLE_PERMISSIONS = Object.freeze([
  PERMISSIONS.VIAGENS_READ,
  PERMISSIONS.VIAGENS_CREATE,
  PERMISSIONS.VIAGENS_START,
  PERMISSIONS.VIAGENS_FINISH,
  PERMISSIONS.VIAGENS_EDIT,
  PERMISSIONS.VIAGENS_DESPESAS_READ,
  PERMISSIONS.VIAGENS_DESPESAS_CREATE,
  PERMISSIONS.VIAGENS_DESPESAS_EDIT,
  PERMISSIONS.VIAGENS_DESPESAS_DELETE,
  PERMISSIONS.VIAGENS_FINANCEIRO,
  PERMISSIONS.VIAGENS_REPORTS,
  PERMISSIONS.GASTOS_READ,
  PERMISSIONS.REPORTS_READ,
]);

const VIAGENS_ALL = [
  PERMISSIONS.VIAGENS_READ,
  PERMISSIONS.VIAGENS_CREATE,
  PERMISSIONS.VIAGENS_START,
  PERMISSIONS.VIAGENS_FINISH,
  PERMISSIONS.VIAGENS_EDIT,
  PERMISSIONS.VIAGENS_DESPESAS_READ,
  PERMISSIONS.VIAGENS_DESPESAS_CREATE,
  PERMISSIONS.VIAGENS_DESPESAS_EDIT,
  PERMISSIONS.VIAGENS_DESPESAS_DELETE,
  PERMISSIONS.VIAGENS_FINANCEIRO,
  PERMISSIONS.VIAGENS_REPORTS,
];

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
  PERMISSIONS.TELEMETRY_READ,
  PERMISSIONS.TELEMETRY_WRITE,
  PERMISSIONS.GASTOS_READ,
  ...VIAGENS_ALL,
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
    PERMISSIONS.TELEMETRY_READ,
    PERMISSIONS.GASTOS_READ,
    PERMISSIONS.VIAGENS_READ,
    PERMISSIONS.VIAGENS_DESPESAS_READ,
    PERMISSIONS.VIAGENS_FINANCEIRO,
    PERMISSIONS.VIAGENS_REPORTS,
  ],
});

/** Prefixo que, em users.permissions, retira uma permissão do perfil. */
export const REVOKE_PREFIX = "-";

/** Permissões padrão do perfil (sem extras nem revogações). */
export function rolePermissions(role) {
  return [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.operator)];
}

/**
 * @param {string} role
 * @param {unknown} extraPermissions
 * @returns {string[]}
 */
export function resolvePermissions(role, extraPermissions = []) {
  const base = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.operator;
  const entries = Array.isArray(extraPermissions)
    ? extraPermissions.filter((p) => typeof p === "string")
    : [];
  const grants = entries.filter((p) => !p.startsWith(REVOKE_PREFIX));
  const set = new Set([...base, ...grants]);
  // Administrador tem acesso completo: revogações não se aplicam.
  if (role !== "admin") {
    for (const p of entries) {
      if (p.startsWith(REVOKE_PREFIX)) set.delete(p.slice(REVOKE_PREFIX.length));
    }
  }
  return [...set];
}

/**
 * Converte o conjunto desejado (só das permissões configuráveis) em entradas
 * de users.permissions, relativas ao perfil: concede o que o perfil não tem e
 * revoga o que ele tem. Extras fora do catálogo configurável são mantidos.
 * @param {string} role
 * @param {string[]} desired permissões configuráveis que o usuário deve ter
 * @param {unknown} current users.permissions atual
 */
export function diffPermissionsForRole(role, desired, current = []) {
  const base = new Set(rolePermissions(role));
  const want = new Set((desired || []).filter((p) => CONFIGURABLE_PERMISSIONS.includes(p)));
  const configurable = new Set(CONFIGURABLE_PERMISSIONS);
  const kept = (Array.isArray(current) ? current : []).filter((p) => {
    if (typeof p !== "string") return false;
    const key = p.startsWith(REVOKE_PREFIX) ? p.slice(REVOKE_PREFIX.length) : p;
    return !configurable.has(key);
  });
  const out = [...kept];
  for (const p of CONFIGURABLE_PERMISSIONS) {
    if (want.has(p) && !base.has(p)) out.push(p);
    if (!want.has(p) && base.has(p)) out.push(`${REVOKE_PREFIX}${p}`);
  }
  return out;
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
