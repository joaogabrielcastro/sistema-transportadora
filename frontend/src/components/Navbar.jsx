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
  { path: "/pneus/atribuir", label: "Instalar pneus" },
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
  { path: "/fiscal/cte", label: "CT-e", permission: PERMISSIONS.CTE_READ },
  { path: "/fiscal/mdfe", label: "MDF-e", permission: PERMISSIONS.MDFE_READ },
  { path: "/fiscal/ciot", label: "CIOT", permission: PERMISSIONS.CIOT_READ },
];

function canSeeFiscalLink(user, sub) {
  if (sub.anyPermission) {
    return sub.anyPermission.some((p) => userHasPermission(user, p));
  }
  return userHasPermission(user, sub.permission);
}

function buildMainLinks(features = {}) {
  const links = [
    { path: "/", label: "Início", exact: true },
    { path: "/manutencao-gastos", label: "Manutenção" },
    {
      path: "/relatorios",
      label: "Relatórios",
      permission: PERMISSIONS.REPORTS_READ,
    },
    { path: "/alertas", label: "Alertas", permission: PERMISSIONS.ALERTS_READ },
    {
      path: "/documentos",
      label: "Documentos",
      permission: PERMISSIONS.DOCS_READ,
    },
    {
      path: "/motoristas",
      label: "Motoristas",
      permission: PERMISSIONS.MOTORISTAS_READ,
    },
  ];

  if (features.ordem_coleta === true) {
    links.push({ path: "/ordem-coleta", label: "Ordem de coleta" });
  }
  if (features.notas_estoque === true) {
    links.push({ path: "/notas-estoque", label: "Notas / Estoque" });
  }

  return links;
}

const isActivePath = (pathname, path, exact = false) => {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
};

const sideLinkClass = (active) =>
  `flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-white/10 text-white"
      : "text-gray-300 hover:bg-white/5 hover:text-white"
  }`;

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

function SidebarNav({
  mainLinks,
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

        <div className="flex flex-col gap-0.5">
          {mainLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={sideLinkClass(
                isActivePath(pathname, link.path, link.exact),
              )}
            >
              {link.label}
            </Link>
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

          {showFiscalMenu && (
            <div>
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
        </div>

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
                Empresa
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

  const mainLinks = buildMainLinks(user?.features).filter(
    (link) => !link.permission || userHasPermission(user, link.permission),
  );
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
    mainLinks,
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
