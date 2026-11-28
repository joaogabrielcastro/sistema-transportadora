import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";

/**
 * Fonte única da navegação autenticada: sidebar, busca rápida (Ctrl+K) e título
 * do topo usam esta estrutura. Cada item replica a mesma regra de acesso da rota
 * em App.jsx (permissão + feature do plano), para não exibir links que levam a 403.
 */

const FISCAL_ADMIN = [
  PERMISSIONS.CTE_WRITE,
  PERMISSIONS.MDFE_WRITE,
  PERMISSIONS.CIOT_WRITE,
];

export const NAV_SECTIONS = [
  {
    id: "visao",
    label: "Visão geral",
    items: [{ path: "/", label: "Painel", icon: "home", exact: true, keywords: "dashboard inicio indicadores pendencias" }],
  },
  {
    id: "frota",
    label: "Frota",
    items: [
      { path: "/frota", label: "Veículos", icon: "truck", keywords: "caminhoes frota placas cavalos carretas" },
      { path: "/motoristas", label: "Motoristas", icon: "user", permission: PERMISSIONS.MOTORISTAS_READ, keywords: "cnh condutores" },
      { path: "/documentos", label: "Documentos", icon: "document", permission: PERMISSIONS.DOCS_READ, keywords: "crlv antt seguro vencimentos" },
      {
        id: "pneus",
        label: "Pneus",
        icon: "tire",
        children: [
          { path: "/pneus", label: "Em uso", exact: true, keywords: "pneus instalados vida util" },
          { path: "/pneus/estoque", label: "Estoque", keywords: "pneus estoque" },
        ],
      },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { path: "/manutencao-gastos", label: "Manutenção e gastos", icon: "wrench", keywords: "despesas combustivel abastecimento multas pedagio checklist" },
      { path: "/relatorios", label: "Relatórios", icon: "chart", permission: PERMISSIONS.REPORTS_READ, keywords: "custo por km indicadores exportar" },
      { path: "/ordem-coleta", label: "Ordem de coleta", icon: "clipboard", feature: "ordem_coleta", permission: PERMISSIONS.ORDEM_SEND, keywords: "coleta envio" },
      { path: "/notas-estoque", label: "Notas e estoque", icon: "box", feature: "notas_estoque", permission: PERMISSIONS.NOTAS_READ, keywords: "nfe xml produtos pecas" },
    ],
  },
  {
    id: "telemetria",
    label: "Telemetria",
    feature: "telemetria",
    items: [
      { path: "/telemetria", label: "Monitoramento", icon: "signal", exact: true, permission: PERMISSIONS.TELEMETRY_READ, keywords: "mapa rastreamento ao vivo gps" },
      { path: "/telemetria/historico", label: "Histórico", icon: "clock", permission: PERMISSIONS.TELEMETRY_READ, keywords: "rotas trajetos" },
      { path: "/telemetria/conducao", label: "Condução", icon: "gauge", permission: PERMISSIONS.TELEMETRY_READ, keywords: "frenagem brusca aceleracao excesso velocidade motorista comportamento" },
      { path: "/telemetria/dispositivos", label: "Dispositivos", icon: "device", permission: PERMISSIONS.TELEMETRY_READ, keywords: "rastreadores imei" },
      { path: "/telemetria/geocercas", label: "Geocercas", icon: "map", permission: PERMISSIONS.TELEMETRY_READ, keywords: "cercas areas" },
      { path: "/telemetria/config", label: "Ajustes", icon: "cog", permission: PERMISSIONS.TELEMETRY_READ, keywords: "telemetria plano retencao equipamentos" },
    ],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    feature: "transporte_fiscal",
    items: [
      { path: "/fiscal/cte", label: "CT-e", icon: "document", permission: PERMISSIONS.CTE_READ, keywords: "conhecimento transporte" },
      { path: "/fiscal/mdfe", label: "MDF-e", icon: "route", permission: PERMISSIONS.MDFE_READ, keywords: "manifesto" },
      { path: "/fiscal/contratos-frete", label: "Contrato de frete", icon: "pencil", permission: PERMISSIONS.CIOT_READ, keywords: "ciot" },
      { path: "/fiscal/empresas", label: "Empresa fiscal", icon: "building", anyPermission: FISCAL_ADMIN, keywords: "certificado cnpj emitente" },
      { path: "/fiscal/seguro", label: "Seguro e averbação", icon: "shield", anyPermission: FISCAL_ADMIN, keywords: "averbacao seguradora" },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    items: [
      { path: "/usuarios", label: "Usuários", icon: "users", permission: PERMISSIONS.USERS_MANAGE, keywords: "equipe convites permissoes" },
      { path: "/empresa", label: "Configurações", icon: "cog", permission: PERMISSIONS.SETTINGS_WRITE, keywords: "empresa alertas whatsapp digest" },
      { path: "/auditoria", label: "Auditoria", icon: "eye", permission: PERMISSIONS.AUDIT_READ, keywords: "logs historico acoes" },
      { path: "/assinatura", label: "Assinatura", icon: "card", billingOnly: true, keywords: "plano pagamento cobranca" },
    ],
  },
];

function featureOn(user, feature) {
  return !feature || user?.features?.[feature] === true;
}

export function canSeeNavItem(user, item) {
  if (!featureOn(user, item.feature)) return false;
  if (item.billingOnly && user?.billingExempt !== false) return false;
  if (item.anyPermission) {
    return item.anyPermission.some((p) => userHasPermission(user, p));
  }
  if (item.permission) return userHasPermission(user, item.permission);
  return true;
}

/** Seções filtradas para o usuário atual (remove itens e grupos sem acesso). */
export function visibleNavSections(user) {
  return NAV_SECTIONS.filter((section) => featureOn(user, section.feature))
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) =>
          item.children
            ? { ...item, children: item.children.filter((c) => canSeeNavItem(user, c)) }
            : item,
        )
        .filter((item) =>
          item.children ? item.children.length > 0 : canSeeNavItem(user, item),
        ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Lista plana de destinos (para a busca rápida). */
export function flatNavItems(user) {
  const out = [];
  for (const section of visibleNavSections(user)) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          out.push({
            ...child,
            icon: item.icon,
            label: `${item.label} · ${child.label}`,
            section: section.label,
          });
        }
      } else {
        out.push({ ...item, section: section.label });
      }
    }
  }
  out.push({ path: "/conta", label: "Minha conta", icon: "user", section: "Conta", keywords: "senha perfil" });
  return out;
}

export const isActivePath = (pathname, path, exact = false) => {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
};

const PAGE_TITLES = [
  ["/caminhao/editar/", "Editar veículo", "Frota"],
  ["/caminhao/", "Veículo", "Frota"],
  ["/cadastro-caminhao", "Novo veículo", "Frota"],
  ["/frota", "Veículos", "Frota"],
  ["/motoristas", "Motoristas", "Frota"],
  ["/documentos", "Documentos", "Frota"],
  ["/pneus/estoque", "Estoque de pneus", "Frota"],
  ["/pneus/atribuir", "Instalar pneus", "Frota"],
  ["/pneu/editar/", "Editar pneu", "Frota"],
  ["/pneus", "Pneus em uso", "Frota"],
  ["/manutencao-gastos", "Manutenção e gastos", "Operação"],
  ["/relatorios", "Relatórios", "Operação"],
  ["/ordem-coleta", "Ordem de coleta", "Operação"],
  ["/notas-estoque", "Notas e estoque", "Operação"],
  ["/telemetria/dispositivos", "Dispositivos", "Telemetria"],
  ["/telemetria/historico", "Histórico e desempenho", "Telemetria"],
  ["/telemetria/conducao", "Condução", "Telemetria"],
  ["/telemetria/geocercas", "Geocercas", "Telemetria"],
  ["/telemetria/config", "Ajustes da telemetria", "Telemetria"],
  ["/telemetria", "Monitoramento", "Telemetria"],
  ["/fiscal/cte", "CT-e", "Fiscal"],
  ["/fiscal/mdfe", "MDF-e", "Fiscal"],
  ["/fiscal/contratos-frete", "Contrato de frete", "Fiscal"],
  ["/fiscal/empresas", "Empresa fiscal", "Fiscal"],
  ["/fiscal/seguro", "Seguro e averbação", "Fiscal"],
  ["/usuarios", "Usuários", "Administração"],
  ["/empresa", "Configurações", "Administração"],
  ["/auditoria", "Auditoria", "Administração"],
  ["/assinatura", "Assinatura", "Administração"],
  ["/conta", "Minha conta", "Conta"],
];

/** `{ title, section }` da rota atual para o topo. */
export function currentPageMeta(pathname) {
  if (pathname === "/") return { title: "Painel", section: "Visão geral" };
  const found = PAGE_TITLES.find(([path]) => pathname.startsWith(path));
  return found ? { title: found[1], section: found[2] } : { title: "ATrack", section: "" };
}
