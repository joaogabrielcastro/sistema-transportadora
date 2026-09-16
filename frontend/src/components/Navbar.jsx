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
    { path: "/alertas", label: "Alertas", permission: PERMISSIONS.ALERTS_READ },
  ];
  if (features.ordem_coleta === true) {
    operacao.push({ path: "/ordem-coleta", label: "Ordem de coleta" });
  }
  if (features.notas_estoque === true) {
    operacao.push({ path: "/notas-estoque", label: "Notas / Estoque" });
  }
  return { visao, frota, operacao };
}

const isActivePath = (pathname, path, exact = false) => {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
};

const sideLinkClass = (active) =>
  `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-white/10 text-white"
      : "text-gray-300 hover:bg-white/5 hover:text-white"
  }`;

function linkIcon(path) {
  const d =
    path === "/"
      ? "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4"
      : path === "/manutencao-gastos"
        ? "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        : path === "/relatorios"
          ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-1-1z"
          : path === "/alertas"
            ? "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            : path === "/documentos"
              ? "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              : path === "/motoristas"
                ? "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                : path === "/ordem-coleta"
                  ? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  : path === "/notas-estoque"
                    ? "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    : "M4 6h16M4 12h16M4 18h16";
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
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
    <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 first:pt-0">
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

  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Menu principal">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {canWriteFrota && !vehicleQuotaReached && (
          <Link
            to="/cadastro-caminhao"
            className="mb-3 flex h-10 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-white hover:bg-secondary-dark"
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

        {showFiscalMenu && (
          <div className="flex flex-col gap-0.5 pt-3">
            <button
              type="button"
              className={`${sideLinkClass(isFiscalSection)} justify-between gap-2`}
              aria-expanded={fiscalOpen}
              onClick={() => setFiscalOpen((open) => !open)}
            >
              Fiscal
              <Chevron open={fiscalOpen} />
            </button>
            {fiscalOpen && (
              <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
                {fiscalLinks.map((sub) => (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    className={`${sideLinkClass(isActivePath(pathname, sub.path))} py-1.5 text-[13px]`}
                  >
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const navGroups = buildNavGroups(user?.features);
  const visaoLinks = filterLinks(navGroups.visao, user);
  const frotaLinks = filterLinks(navGroups.frota, user);
  const operacaoLinks = filterLinks(navGroups.operacao, user);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/pneus")) setPneusOpen(true);
    if (location.pathname.startsWith("/fiscal")) setFiscalOpen(true);
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
    pathname: location.pathname,
    pneusOpen,
    setPneusOpen,
    fiscalOpen,
    setFiscalOpen,
    showFiscalMenu,
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-primary shadow-md lg:flex">
        <div className="shrink-0 border-b border-white/10 px-4 py-4">{brand}</div>
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

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default Navbar;
