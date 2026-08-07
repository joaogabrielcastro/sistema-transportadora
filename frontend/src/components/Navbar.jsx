import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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

const pneusSubLinks = [
  { path: "/pneus", label: "Pneus em uso" },
  { path: "/pneus/estoque", label: "Estoque" },
  { path: "/pneus/atribuir", label: "Instalar pneus" },
];

function buildMainLinks(features = {}) {
  const links = [
    { path: "/", label: "Início", exact: true },
    { path: "/manutencao-gastos", label: "Manutenção" },
    { path: "/relatorios", label: "Relatórios" },
    { path: "/alertas", label: "Alertas" },
    { path: "/documentos", label: "Documentos" },
    { path: "/motoristas", label: "Motoristas" },
  ];

  if (features.ordem_coleta === true) {
    links.push({ path: "/ordem-coleta", label: "Ordem de coleta" });
  }
  if (features.notas_estoque === true) {
    links.push({ path: "/notas-estoque", label: "Notas / Estoque" });
  }

  return links;
}

const navItemClass = (active) =>
  `inline-flex h-9 items-center px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
    active
      ? "bg-white/10 text-white border border-white/10"
      : "text-gray-300 hover:bg-white/5 hover:text-white border border-transparent"
  }`;

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pneusMenuOpen, setPneusMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHeight, setNavHeight] = useState(64);
  const navRef = useRef(null);
  const pneusMenuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const mainLinks = buildMainLinks(user?.features);
  const showBillingLink = isAuthenticated && user?.billingExempt === false;
  const canWriteFrota = userHasPermission(user, PERMISSIONS.FROTA_WRITE);
  const canManageUsers = userHasPermission(user, PERMISSIONS.USERS_MANAGE);
  const trialDays = trialDaysRemaining(user);
  const showTrialBanner =
    showBillingLink &&
    user?.subscriptionStatus === "trialing" &&
    trialDays != null;
  const showPastDueBanner =
    showBillingLink && user?.subscriptionStatus === "past_due";
  const showBanner = showTrialBanner || showPastDueBanner;

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;

    const update = () => setNavHeight(el.getBoundingClientRect().height || 64);
    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [showBanner, scrolled, isMobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setPneusMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pneusMenuRef.current &&
        !pneusMenuRef.current.contains(event.target)
      ) {
        setPneusMenuOpen(false);
      }
    };

    if (pneusMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pneusMenuOpen]);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const isPneusSection = location.pathname.startsWith("/pneus");

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "bg-primary/95 backdrop-blur-md shadow-lg"
            : "bg-primary"
        }`}
      >
        {showBanner && (
          <div
            className={`text-center text-xs sm:text-sm px-3 py-1.5 leading-snug ${
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
        )}

        <div
          className={`container mx-auto px-4 md:px-6 flex items-center justify-between gap-3 ${
            scrolled ? "h-14" : "h-16"
          }`}
        >
          <Link
            to="/"
            className="flex items-center group min-w-0 max-w-[calc(100%-3.5rem)] xl:max-w-none"
          >
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-9 w-9 object-contain rounded-lg bg-white p-1 mr-2.5 flex-shrink-0 group-hover:opacity-90 transition-opacity"
            />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-base md:text-lg font-bold text-white tracking-tight truncate">
                {PRODUCT_NAME}
              </span>
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider truncate">
                {user?.tenantNome || PRODUCT_TAGLINE}
              </span>
            </div>
          </Link>

          <div className="hidden xl:flex items-center min-w-0 flex-1 justify-end gap-1 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-0">
              {mainLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={navItemClass(isActive(link.path, link.exact))}
                >
                  {link.label}
                </Link>
              ))}

              <div className="relative" ref={pneusMenuRef}>
                <button
                  type="button"
                  className={`${navItemClass(isPneusSection)} gap-1`}
                  aria-expanded={pneusMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setPneusMenuOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setPneusMenuOpen(false);
                    }
                  }}
                >
                  Pneus
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${pneusMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {pneusMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-52 py-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50">
                    {pneusSubLinks.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          isActive(sub.path, sub.path === "/pneus")
                            ? "text-white bg-white/10"
                            : "text-gray-300 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-white/15 shrink-0">
              {canWriteFrota && (
                <Link
                  to="/cadastro-caminhao"
                  className="inline-flex h-9 items-center px-3.5 rounded-lg text-sm font-semibold bg-secondary text-white hover:bg-secondary-dark transition-colors whitespace-nowrap"
                >
                  + Caminhão
                </Link>
              )}
              {showBillingLink && (
                <Link
                  to="/assinatura"
                  className={navItemClass(isActive("/assinatura"))}
                >
                  Assinatura
                </Link>
              )}
              {isAuthenticated && canManageUsers && (
                <Link
                  to="/usuarios"
                  className={navItemClass(isActive("/usuarios"))}
                >
                  Usuários
                </Link>
              )}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className={navItemClass(false)}
                  title={user?.email || "Sair"}
                >
                  Sair
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="xl:hidden text-gray-300 hover:text-white focus:outline-none p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-md hover:bg-white/10 transition-colors shrink-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        <div
          className={`xl:hidden absolute top-full left-0 right-0 z-[60] bg-primary border-t border-white/10 shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen
              ? "max-h-[min(85vh,calc(100dvh-4rem))] opacity-100 overflow-y-auto"
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="container mx-auto py-4 px-4 flex flex-col gap-1">
            {mainLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  isActive(link.path, link.exact)
                    ? "bg-secondary text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-2 pb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Pneus
            </div>
            {pneusSubLinks.map((sub) => (
              <Link
                key={sub.path}
                to={sub.path}
                className={`px-4 py-3 rounded-lg pl-8 transition-colors ${
                  isActive(sub.path, sub.path === "/pneus")
                    ? "bg-secondary text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {sub.label}
              </Link>
            ))}

            {canWriteFrota && (
              <Link
                to="/cadastro-caminhao"
                className="mt-3 mx-4 py-3 rounded-lg text-center font-semibold bg-secondary text-white hover:bg-secondary-dark transition-colors"
              >
                Cadastrar caminhão
              </Link>
            )}
            {showBillingLink && (
              <Link
                to="/assinatura"
                className={`mx-4 mt-2 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/assinatura")
                    ? "bg-secondary text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                Assinatura
              </Link>
            )}
            {isAuthenticated && canManageUsers && (
              <Link
                to="/usuarios"
                className={`mx-4 mt-2 px-4 py-3 rounded-lg transition-colors ${
                  isActive("/usuarios")
                    ? "bg-secondary text-white"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                Usuários
              </Link>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                  setIsMobileMenuOpen(false);
                }}
                className="mt-2 mx-4 py-3 rounded-lg text-center text-gray-300 hover:text-white hover:bg-white/10"
              >
                Sair{user?.email ? ` (${user.email})` : ""}
              </button>
            )}
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <button
          type="button"
          className="xl:hidden fixed inset-0 z-40 bg-black/40"
          aria-label="Fechar menu"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div aria-hidden style={{ height: navHeight }} />
    </>
  );
};

export default Navbar;
