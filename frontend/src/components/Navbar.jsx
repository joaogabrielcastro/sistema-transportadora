import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../brand.js";
import { trialDaysRemaining, isVehicleQuotaReached } from "../utils/billing.js";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";

const pneusSubLinks = [
  { path: "/pneus", label: "Pneus em uso", exact: true },
  { path: "/pneus/estoque", label: "Estoque" },
];

const fiscalSubLinks = [
  {
    path: "/fiscal/empresas",
    label: "Empresa fiscal",
    permission: PERMISSIONS.CTE_WRITE,
    anyPermission: [
      PERMISSIONS.CTE_WRITE,
      PERMISSIONS.MDFE_WRITE,
      PERMISSIONS.CIOT_WRITE,
    ],
  },
  {
    path: "/fiscal/seguro",
    label: "Seguro / Averbação",
    permission: PERMISSIONS.CTE_WRITE,
    anyPermission: [
      PERMISSIONS.CTE_WRITE,
      PERMISSIONS.MDFE_WRITE,
      PERMISSIONS.CIOT_WRITE,
    ],
  },
  { path: "/fiscal/cte", label: "CT-e", permission: PERMISSIONS.CTE_READ },
  { path: "/fiscal/mdfe", label: "MDF-e", permission: PERMISSIONS.MDFE_READ },
  { path: "/fiscal/contratos-frete", label: "Contrato de Frete", permission: PERMISSIONS.CIOT_READ },
];

function canSeeFiscalLink(user, sub) {
  if (sub.anyPermission) {
    return sub.anyPermission.some((p) => userHasPermission(user, p));
  }
  return userHasPermission(user, sub.permission);
}

function filterLinks(links, user) {
  return links.filter(
    (link) => !link.permission || userHasPermission(user, link.permission),
  );
}

function buildNavGroups(features = {}) {
  const visao = [{ path: "/", label: "Início", exact: true }];
  const frota = [
    {
      path: "/motoristas",
      label: "Motoristas",
      permission: PERMISSIONS.MOTORISTAS_READ,
    },
    {
      path: "/documentos",
      label: "Documentos",
      permission: PERMISSIONS.DOCS_READ,
    },
  ];
  const operacao = [
    { path: "/manutencao-gastos", label: "Manutenção" },
    {
      path: "/relatorios",
      label: "Relatórios",
      permission: PERMISSIONS.REPORTS_READ,
    },
  ];
  if (features.ordem_coleta === true) {
    operacao.push({ path: "/ordem-coleta", label: "Ordem de coleta" });
  }
  if (features.notas_estoque === true) {
    operacao.push({ path: "/notas-estoque", label: "Notas / Estoque" });
  }
  const telemetria = [];
  if (features.telemetria === true) {
    telemetria.push(
      { path: "/telemetria", label: "Monitoramento", exact: true, permission: PERMISSIONS.TELEMETRY_READ },
      { path: "/telemetria/historico", label: "Histórico", permission: PERMISSIONS.TELEMETRY_READ },
      { path: "/telemetria/dispositivos", label: "Dispositivos", permission: PERMISSIONS.TELEMETRY_READ },
      { path: "/telemetria/geocercas", label: "Geocercas", permission: PERMISSIONS.TELEMETRY_READ },
      { path: "/telemetria/config", label: "Config", permission: PERMISSIONS.TELEMETRY_READ },
    );
  }
  return { visao, frota, operacao, telemetria };
}

const isActivePath = (pathname, path, exact = false) => {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
};

const sideLinkClass = (active) =>
  `group flex min-h-10 w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
    active
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
      : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

const PAGE_TITLES = [
  ["/caminhao/editar/", "Editar veículo"],
  ["/caminhao/", "Detalhes do veículo"],
  ["/cadastro-caminhao", "Novo veículo"],
  ["/manutencao-gastos", "Manutenção e gastos"],
  ["/pneus/estoque", "Estoque de pneus"],
  ["/pneus", "Pneus"],
  ["/motoristas", "Motoristas"],
  ["/documentos", "Documentos"],
  ["/relatorios", "Relatórios"],
  ["/telemetria/dispositivos", "Dispositivos"],
  ["/telemetria/historico", "Histórico"],
  ["/telemetria/geocercas", "Geocercas"],
  ["/telemetria/config", "Configurações"],
  ["/telemetria/mapa", "Monitoramento"],
  ["/telemetria", "Monitoramento"],
  ["/notas-estoque", "Notas e estoque"],
  ["/fiscal", "Fiscal"],
  ["/usuarios", "Usuários"],
  ["/empresa", "Configurações"],
  ["/auditoria", "Auditoria"],
  ["/conta", "Minha conta"],
  ["/assinatura", "Assinatura"],
  ["/", "Visão geral"],
];

function currentPageTitle(pathname) {
  return PAGE_TITLES.find(([path]) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path),
  )?.[1] || "ATrack";
}

const LINK_ICON_PATHS = {
  "/":
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4",
  "/manutencao-gastos":
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  "/relatorios":
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-1-1z",
  "/documentos":
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "/motoristas":
    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  "/ordem-coleta":
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "/notas-estoque":
    "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  // Grupo Telemetria (pai) — sinal/radar
  "/telemetria/mapa":
    "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.15 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
  // Monitoramento — olho / visão ao vivo
  "/telemetria":
    "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  "/telemetria/dispositivos":
    "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  "/telemetria/historico":
    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  "/telemetria/geocercas":
    "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  "/telemetria/config":
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  // Fiscal
  "/fiscal":
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "/fiscal/empresas":
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "/fiscal/seguro":
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "/fiscal/cte":
    "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  "/fiscal/mdfe":
    "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2",
  "/fiscal/contratos-frete":
    "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

function linkIcon(path) {
  const d = LINK_ICON_PATHS[path] || "M4 6h16M4 12h16M4 18h16";
  // Alguns ícones Heroicons usam 2 paths no mesmo `d` (ex.: olho).
  const parts = String(d)
    .split(/\s(?=M)/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {parts.map((part) => (
        <path
          key={part}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={part}
        />
      ))}
    </svg>
  );
}

const Chevron = ({ open }) => (
  <svg
    className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

function NavLink({ link, pathname }) {
  return (
    <Link
      to={link.path}
      className={sideLinkClass(isActivePath(pathname, link.path, link.exact))}
    >
      <span className="opacity-80" aria-hidden>
        {linkIcon(link.path)}
      </span>
      {link.label}
    </Link>
  );
}

function GroupLabel({ children }) {
  return (
    <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 first:pt-0">
      {children}
    </p>
  );
}

function SidebarNav({
  visaoLinks,
  frotaLinks,
  operacaoLinks,
  fiscalLinks,
  pathname,
  pneusOpen,
  setPneusOpen,
  fiscalOpen,
  setFiscalOpen,
  showFiscalMenu,
  telemetriaLinks,
  showTelemetriaMenu,
  telemetriaOpen,
  setTelemetriaOpen,
  canWriteFrota,
  vehicleQuotaReached,
  showBillingLink,
  canManageUsers,
  canWriteSettings,
  canReadAudit,
  isAuthenticated,
  user,
  onLogout,
}) {
  const isPneusSection = pathname.startsWith("/pneus");
  const isFiscalSection = pathname.startsWith("/fiscal");
  const isTelemetriaSection = pathname.startsWith("/telemetria");

  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Menu principal">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {canWriteFrota && !vehicleQuotaReached && (
          <Link
            to="/cadastro-caminhao"
            className="mb-4 flex h-10 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-white transition-colors hover:bg-secondary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            + Caminhão
          </Link>
        )}

        <GroupLabel>Visão geral</GroupLabel>
        <div className="flex flex-col gap-0.5">
          {visaoLinks.map((link) => (
            <NavLink key={link.path} link={link} pathname={pathname} />
          ))}
        </div>

        <GroupLabel>Frota</GroupLabel>
        <div className="flex flex-col gap-0.5">
          {frotaLinks.map((link) => (
            <NavLink key={link.path} link={link} pathname={pathname} />
          ))}
          <div>
            <button
              type="button"
              className={`${sideLinkClass(isPneusSection)} justify-between gap-2`}
              aria-expanded={pneusOpen}
              onClick={() => setPneusOpen((open) => !open)}
            >
              Pneus
              <Chevron open={pneusOpen} />
            </button>
            {pneusOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                {pneusSubLinks.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={`${sideLinkClass(
                      isActivePath(
                        pathname,
                        sub.path,
                        sub.exact || sub.path === "/pneus",
                      ),
                    )} py-1.5 text-[13px]`}
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <GroupLabel>Operação</GroupLabel>
        <div className="flex flex-col gap-0.5">
          {operacaoLinks.map((link) => (
            <NavLink key={link.path} link={link} pathname={pathname} />
          ))}
        </div>

        {showTelemetriaMenu && (
          <div className="flex flex-col gap-0.5 pt-3">
            <button
              type="button"
              className={`${sideLinkClass(isTelemetriaSection)} justify-between gap-2`}
              aria-expanded={telemetriaOpen}
              onClick={() => setTelemetriaOpen((open) => !open)}
            >
              <span className="flex items-center gap-3">
                <span className="opacity-80" aria-hidden>
                  {linkIcon("/telemetria/mapa")}
                </span>
                Telemetria
              </span>
              <Chevron open={telemetriaOpen} />
            </button>
            {telemetriaOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                {telemetriaLinks.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={`${sideLinkClass(
                      isActivePath(pathname, sub.path, sub.exact),
                    )} gap-2.5 py-1.5 text-[13px]`}
                  >
                    <span className="opacity-80" aria-hidden>
                      {linkIcon(sub.path)}
                    </span>
                    {sub.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {showFiscalMenu && (
          <div className="flex flex-col gap-0.5 pt-3">
            <button
              type="button"
              className={`${sideLinkClass(isFiscalSection)} justify-between gap-2`}
              aria-expanded={fiscalOpen}
              onClick={() => setFiscalOpen((open) => !open)}
            >
              <span className="flex items-center gap-3">
                <span className="opacity-80" aria-hidden>
                  {linkIcon("/fiscal")}
                </span>
                Fiscal
              </span>
              <Chevron open={fiscalOpen} />
            </button>
            {fiscalOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                {fiscalLinks.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={`${sideLinkClass(isActivePath(pathname, sub.path))} gap-2.5 py-1.5 text-[13px]`}
                  >
                    <span className="opacity-80" aria-hidden>
                      {linkIcon(sub.path)}
                    </span>
                    {sub.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Conta
          </p>
          <div className="flex flex-col gap-0.5">
            {showBillingLink && (
              <Link
                to="/assinatura"
                className={sideLinkClass(isActivePath(pathname, "/assinatura"))}
              >
                Assinatura
              </Link>
            )}
            {isAuthenticated && canManageUsers && (
              <Link
                to="/usuarios"
                className={sideLinkClass(isActivePath(pathname, "/usuarios"))}
              >
                Usuários
              </Link>
            )}
            {isAuthenticated && canWriteSettings && (
              <Link
                to="/empresa"
                className={sideLinkClass(isActivePath(pathname, "/empresa"))}
              >
                Configurações
              </Link>
            )}
            {isAuthenticated && canReadAudit && (
              <Link
                to="/auditoria"
                className={sideLinkClass(isActivePath(pathname, "/auditoria"))}
              >
                Auditoria
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/conta"
                className={sideLinkClass(isActivePath(pathname, "/conta"))}
              >
                Minha conta
              </Link>
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <div className="shrink-0 border-t border-white/10 p-3">
          <p className="truncate px-3 text-xs text-gray-400" title={user?.email}>
            {user?.email}
          </p>
          <button
            type="button"
            onClick={onLogout}
            className={`${sideLinkClass(false)} mt-1`}
          >
            Sair
          </button>
        </div>
      )}
    </nav>
  );
}

/**
 * Shell autenticado: sidebar à esquerda no desktop, drawer no mobile.
 */
const Navbar = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pneusOpen, setPneusOpen] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [telemetriaOpen, setTelemetriaOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const navGroups = buildNavGroups(user?.features);
  const visaoLinks = filterLinks(navGroups.visao, user);
  const frotaLinks = filterLinks(navGroups.frota, user);
  const operacaoLinks = filterLinks(navGroups.operacao, user);
  const telemetriaLinks = filterLinks(navGroups.telemetria || [], user);
  const fiscalLinks = fiscalSubLinks.filter((sub) => canSeeFiscalLink(user, sub));
  const showBillingLink = isAuthenticated && user?.billingExempt === false;
  const canWriteFrota = userHasPermission(user, PERMISSIONS.FROTA_WRITE);
  const vehicleQuotaReached = isVehicleQuotaReached(user);
  const canManageUsers = userHasPermission(user, PERMISSIONS.USERS_MANAGE);
  const canWriteSettings = userHasPermission(user, PERMISSIONS.SETTINGS_WRITE);
  const canReadAudit = userHasPermission(user, PERMISSIONS.AUDIT_READ);
  const trialDays = trialDaysRemaining(user);
  const showTrialBanner =
    showBillingLink &&
    user?.subscriptionStatus === "trialing" &&
    trialDays != null;
  const showPastDueBanner =
    showBillingLink && user?.subscriptionStatus === "past_due";
  const showBanner = showTrialBanner || showPastDueBanner;
  const showFiscalMenu =
    user?.features?.transporte_fiscal === true && fiscalLinks.length > 0;
  const showTelemetriaMenu =
    user?.features?.telemetria === true && telemetriaLinks.length > 0;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/pneus")) setPneusOpen(true);
    if (location.pathname.startsWith("/fiscal")) setFiscalOpen(true);
    if (location.pathname.startsWith("/telemetria")) setTelemetriaOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMobileOpen(false);
  };

  const navProps = {
    visaoLinks,
    frotaLinks,
    operacaoLinks,
    fiscalLinks,
    telemetriaLinks,
    pathname: location.pathname,
    pneusOpen,
    setPneusOpen,
    fiscalOpen,
    setFiscalOpen,
    showFiscalMenu,
    showTelemetriaMenu,
    telemetriaOpen,
    setTelemetriaOpen,
    canWriteFrota,
    vehicleQuotaReached,
    showBillingLink,
    canManageUsers,
    canWriteSettings,
    canReadAudit,
    isAuthenticated,
    user,
    onLogout: handleLogout,
  };

  const brand = (
    <Link to="/" className="flex min-w-0 items-center gap-2.5">
      <img
        src={PRODUCT_LOGO_SRC}
        alt={PRODUCT_LOGO_ALT}
        className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1"
      />
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-base font-bold tracking-tight text-white">
          {PRODUCT_NAME}
        </span>
        <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-gray-400">
          {user?.tenantNome || PRODUCT_TAGLINE}
        </span>
      </div>
    </Link>
  );

  const banner = showBanner ? (
    <div
      className={`text-center text-xs leading-snug sm:text-sm px-3 py-1.5 ${
        showPastDueBanner
          ? "bg-amber-500 text-amber-950"
          : "bg-secondary text-white"
      }`}
    >
      {showPastDueBanner ? (
        <>
          Pagamento pendente.{" "}
          <Link to="/assinatura" className="font-semibold underline">
            Regularizar assinatura
          </Link>
        </>
      ) : (
        <>
          {trialDays === 0
            ? "Último dia do período de teste."
            : `Período de teste: restam ${trialDays} dia${trialDays === 1 ? "" : "s"}.`}{" "}
          <Link to="/assinatura" className="font-semibold underline">
            Ver planos
          </Link>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-primary lg:flex xl:w-72">
        <div className="shrink-0 border-b border-white/10 px-5 py-5">{brand}</div>
        <SidebarNav {...navProps} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="sticky top-0 z-50 flex h-14 items-center gap-3 bg-primary px-4 shadow-md lg:hidden">
          {brand}
          <button
            type="button"
            className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2.5 text-gray-300 hover:bg-white/10 hover:text-white"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </header>

        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary shadow-xl lg:hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                {brand}
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <SidebarNav {...navProps} />
            </aside>
          </>
        )}

        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-white/95 px-6 backdrop-blur lg:flex xl:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
              Central operacional
            </p>
            <p className="truncate text-sm font-semibold text-text-primary">
              {currentPageTitle(location.pathname)}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden text-right xl:block">
              <p className="max-w-56 truncate text-sm font-medium text-text-primary">
                {user?.nome || "Usuário"}
              </p>
              <p className="max-w-56 truncate text-xs text-text-secondary">
                {user?.tenantNome || user?.email}
              </p>
            </div>
            <Link
              to="/conta"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              aria-label="Abrir minha conta"
              title="Minha conta"
            >
              {(user?.nome || user?.email || "U").trim().charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
};

export default Navbar;
