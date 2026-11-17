import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../brand.js";
import { trialDaysRemaining } from "../utils/billing.js";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import Icon from "./ui/Icon.jsx";
import CommandPalette from "./layout/CommandPalette.jsx";
import {
  currentPageMeta,
  flatNavItems,
  isActivePath,
  visibleNavSections,
} from "./layout/navConfig.js";
import { quickActionsFor } from "./layout/quickActions.js";
import { useOpsAlertsQuery } from "../hooks/queries/useOpsAlertsQuery.js";

/** Seções que podem ser recolhidas (as demais ficam sempre abertas). */
const COLLAPSIBLE_SECTIONS = new Set(["telemetria", "fiscal", "admin"]);
const COLLAPSE_STORAGE_KEY = "atrack_nav_collapsed";

function readCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* modo privado: preferência só na sessão */
  }
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");

function initials(user) {
  const base = String(user?.nome || user?.email || "U").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return base.charAt(0).toUpperCase();
}

/** Fecha popovers ao clicar fora ou pressionar Esc. */
function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

const navItemClass = (active, nested = false) =>
  `group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
    nested ? "min-h-8 py-1.5 pl-9" : "min-h-9 py-2"
  } ${
    active
      ? "bg-white/[0.08] text-white"
      : "text-ink-300 hover:bg-white/[0.04] hover:text-white"
  }`;

function ActiveBar({ active }) {
  if (!active) return null;
  return (
    <span
      className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-400"
      aria-hidden
    />
  );
}

ActiveBar.propTypes = { active: PropTypes.bool };

function SidebarItem({ item, pathname, badge }) {
  const [open, setOpen] = useState(() =>
    item.children ? item.children.some((c) => isActivePath(pathname, c.path, c.exact)) : false,
  );
  const childActive = item.children?.some((c) => isActivePath(pathname, c.path, c.exact));

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          className={navItemClass(false)}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={item.icon} className={`h-[18px] w-[18px] ${childActive ? "text-cyan-300" : "text-ink-400 group-hover:text-ink-300"}`} />
          <span className={`flex-1 text-left ${childActive ? "text-white" : ""}`}>{item.label}</span>
          <Icon
            name="chevronDown"
            className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open ? (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {item.children.map((child) => {
              const active = isActivePath(pathname, child.path, child.exact);
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  className={navItemClass(active, true)}
                  aria-current={active ? "page" : undefined}
                >
                  <ActiveBar active={active} />
                  {child.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  const active = isActivePath(pathname, item.path, item.exact);
  return (
    <Link
      to={item.path}
      className={navItemClass(active)}
      aria-current={active ? "page" : undefined}
    >
      <ActiveBar active={active} />
      <Icon
        name={item.icon}
        className={`h-[18px] w-[18px] ${active ? "text-cyan-300" : "text-ink-400 group-hover:text-ink-300"}`}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

SidebarItem.propTypes = {
  item: PropTypes.object.isRequired,
  pathname: PropTypes.string.isRequired,
  badge: PropTypes.node,
};

function SidebarSection({ section, pathname, collapsed, onToggle, badges }) {
  const collapsible = COLLAPSIBLE_SECTIONS.has(section.id);
  const hasActive = section.items.some((item) =>
    item.children
      ? item.children.some((c) => isActivePath(pathname, c.path, c.exact))
      : isActivePath(pathname, item.path, item.exact),
  );
  const isOpen = !collapsible || !collapsed || hasActive;

  return (
    <div className="pt-4 first:pt-1">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between rounded-md px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400 hover:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
        >
          {section.label}
          <Icon name="chevronDown" className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
        </button>
      ) : (
        <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          {section.label}
        </p>
      )}
      {isOpen ? (
        <div className="flex flex-col gap-0.5">
          {section.items.map((item) => (
            <SidebarItem
              key={item.path || item.id}
              item={item}
              pathname={pathname}
              badge={badges[item.path]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

SidebarSection.propTypes = {
  section: PropTypes.object.isRequired,
  pathname: PropTypes.string.isRequired,
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  badges: PropTypes.object.isRequired,
};

function UserMenu({ user, onLogout, placement = "top" }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const isTop = placement === "top";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          isTop
            ? "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            : "flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
        }
        aria-label="Abrir menu do usuário"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white ring-2 ring-white/10">
          {initials(user)}
        </span>
        {isTop ? (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-white">
                {user?.nome || "Usuário"}
              </span>
              <span className="block truncate text-[11px] text-ink-400" title={user?.email}>
                {user?.email}
              </span>
            </span>
            <Icon name="chevronDown" className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "" : "rotate-180"}`} />
          </>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-[70] w-60 animate-pop-in overflow-hidden rounded-xl border border-border bg-white p-1 text-sm shadow-pop ${
            isTop ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate font-semibold text-text-primary">{user?.nome || "Usuário"}</p>
            <p className="truncate text-xs text-text-secondary">{user?.tenantNome || user?.email}</p>
            {user?.role ? (
              <p className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium capitalize text-text-secondary">
                {user.role === "admin" ? "Administrador" : user.role === "operator" ? "Operador" : user.role}
              </p>
            ) : null}
          </div>
          <Link
            role="menuitem"
            to="/conta"
            onClick={close}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-text-primary hover:bg-slate-100"
          >
            <Icon name="user" className="h-4 w-4 text-text-secondary" /> Minha conta
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"
          >
            <Icon name="logout" className="h-4 w-4" /> Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}

UserMenu.propTypes = {
  user: PropTypes.object,
  onLogout: PropTypes.func.isRequired,
  placement: PropTypes.oneOf(["top", "bottom"]),
};

function NewMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  if (!actions.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(11,19,36,0.2)] transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />
        <span className="hidden sm:inline">Novo</span>
        <span className="sr-only sm:hidden">Novo cadastro</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[70] mt-2 w-72 animate-pop-in rounded-xl border border-border bg-white p-1.5 shadow-pop"
        >
          {actions.map((a) => (
            <Link
              key={a.id}
              role="menuitem"
              to={a.to}
              onClick={close}
              className="flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-100"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-text-secondary">
                <Icon name={a.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{a.label}</span>
                <span className="block text-xs text-text-secondary">{a.description}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

NewMenu.propTypes = { actions: PropTypes.array.isRequired };

function AlertsBell({ counts, loading }) {
  const total = counts?.total ?? 0;
  const urgent = (counts?.critical ?? 0) + (counts?.high ?? 0);
  return (
    <Link
      to="/#pendencias"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-slate-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      aria-label={
        loading ? "Pendências operacionais" : `${total} pendência(s) operacional(is)`
      }
      title="Pendências operacionais"
    >
      <Icon name="bell" className="h-[18px] w-[18px]" />
      {!loading && total > 0 ? (
        <span
          className={`absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white tabular-nums ${
            urgent > 0 ? "bg-red-600" : "bg-amber-500"
          }`}
        >
          {total > 99 ? "99+" : total}
        </span>
      ) : null}
    </Link>
  );
}

AlertsBell.propTypes = { counts: PropTypes.object, loading: PropTypes.bool };

/**
 * Shell autenticado: sidebar fixa no desktop, drawer no mobile, topo com
 * contexto da página, busca rápida (Ctrl/⌘+K), cadastro rápido e pendências.
 */
const Navbar = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const sections = useMemo(() => visibleNavSections(user), [user]);
  const destinations = useMemo(() => flatNavItems(user), [user]);
  const actions = useMemo(() => quickActionsFor(user), [user]);
  const pageMeta = currentPageMeta(location.pathname);

  const canReadAlerts = isAuthenticated && userHasPermission(user, PERMISSIONS.ALERTS_READ);
  const alertsQuery = useOpsAlertsQuery(canReadAlerts);
  const urgentCount =
    (alertsQuery.data?.counts?.critical ?? 0) + (alertsQuery.data?.counts?.high ?? 0);

  const showBillingLink = isAuthenticated && user?.billingExempt === false;
  const trialDays = trialDaysRemaining(user);
  const showTrialBanner =
    showBillingLink && user?.subscriptionStatus === "trialing" && trialDays != null;
  const showPastDueBanner = showBillingLink && user?.subscriptionStatus === "past_due";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Rolagem até âncoras (ex.: /#pendencias) após a navegação.
  useEffect(() => {
    if (!location.hash) return undefined;
    const id = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [location.hash, location.pathname]);

  const toggleSection = (id) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeCollapsed(next);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMobileOpen(false);
  };

  const badges = useMemo(
    () => (urgentCount > 0 ? { "/": urgentCount > 99 ? "99+" : urgentCount } : {}),
    [urgentCount],
  );

  const brand = (
    <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
      <img
        src={PRODUCT_LOGO_SRC}
        alt={PRODUCT_LOGO_ALT}
        className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
      />
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-bold tracking-tight text-white">
          {PRODUCT_NAME}
        </span>
        <span className="block truncate text-[11px] font-medium text-ink-400">
          {user?.tenantNome || PRODUCT_TAGLINE}
        </span>
      </div>
    </Link>
  );

  const searchTrigger = (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-left text-[13px] text-ink-400 transition-colors hover:border-white/20 hover:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
    >
      <Icon name="search" className="h-4 w-4" />
      <span className="flex-1">Buscar…</span>
      <span className="rounded border border-white/10 px-1.5 text-[10px] font-semibold text-ink-400">
        {isMac ? "⌘K" : "Ctrl K"}
      </span>
    </button>
  );

  const sidebarBody = (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Menu principal">
      <div className="px-3 pb-2 pt-3">{searchTrigger}</div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <SidebarSection
            key={section.id}
            section={section}
            pathname={location.pathname}
            collapsed={Boolean(collapsed[section.id])}
            onToggle={() => toggleSection(section.id)}
            badges={badges}
          />
        ))}
      </div>
      {isAuthenticated ? (
        <div className="shrink-0 border-t border-white/[0.06] p-2">
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      ) : null}
    </nav>
  );

  const banner =
    showTrialBanner || showPastDueBanner ? (
      <div
        className={`flex items-center justify-center gap-2 px-3 py-1.5 text-center text-xs leading-snug sm:text-[13px] ${
          showPastDueBanner ? "bg-amber-400 text-amber-950" : "bg-ink-800 text-ink-300"
        }`}
      >
        {showPastDueBanner ? (
          <>
            <Icon name="alert" className="h-4 w-4" />
            Pagamento pendente.
            <Link to="/assinatura" className="font-semibold underline underline-offset-2">
              Regularizar assinatura
            </Link>
          </>
        ) : (
          <>
            <span className="text-white">
              {trialDays === 0
                ? "Último dia do período de teste."
                : `Período de teste: restam ${trialDays} dia${trialDays === 1 ? "" : "s"}.`}
            </span>
            <Link to="/assinatura" className="font-semibold text-cyan-300 underline underline-offset-2">
              Ver planos
            </Link>
          </>
        )}
      </div>
    ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-black/20 bg-ink-950 lg:flex">
        <div className="shrink-0 px-4 pb-1 pt-4">{brand}</div>
        {sidebarBody}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-white/90 px-3 backdrop-blur-md sm:px-4 lg:h-[60px] lg:px-6 xl:px-8">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-slate-100 hover:text-text-primary lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-label="Abrir menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {pageMeta.section ? (
              <p className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-text-light sm:block">
                {pageMeta.section}
              </p>
            ) : null}
            <p className="truncate text-[15px] font-semibold text-text-primary">{pageMeta.title}</p>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 text-left text-sm text-text-light transition-colors hover:border-border-strong hover:bg-white md:flex xl:w-80"
            aria-label="Abrir busca rápida"
          >
            <Icon name="search" className="h-4 w-4" />
            <span className="flex-1 truncate">Buscar placa, motorista, módulo…</span>
            <kbd className="kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-slate-100 hover:text-text-primary md:hidden"
            aria-label="Abrir busca rápida"
          >
            <Icon name="search" className="h-[18px] w-[18px]" />
          </button>

          {canReadAlerts ? (
            <AlertsBell counts={alertsQuery.data?.counts} loading={alertsQuery.isLoading} />
          ) : null}
          <NewMenu actions={actions} />
          {isAuthenticated ? (
            <div className="hidden lg:block">
              <UserMenu user={user} onLogout={handleLogout} placement="bottom" />
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(86vw,300px)] animate-drawer-in flex-col bg-ink-950 shadow-pop">
            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
              {brand}
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-300 hover:bg-white/10 hover:text-white"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        destinations={destinations}
        actions={actions}
      />
    </div>
  );
};

Navbar.propTypes = { children: PropTypes.node };

export default Navbar;
