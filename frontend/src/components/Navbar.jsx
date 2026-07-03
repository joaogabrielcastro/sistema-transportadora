import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const pneusSubLinks = [
  { path: "/pneus", label: "Pneus em uso" },
  { path: "/pneus/estoque", label: "Estoque" },
  { path: "/pneus/atribuir", label: "Atribuir pneu" },
  { path: "/pneus/cadastro-em-lote", label: "Cadastro em lote" },
];

const mainLinks = [
  { path: "/", label: "Início", exact: true },
  { path: "/manutencao-gastos", label: "Manutenção" },
  { path: "/relatorios", label: "Relatórios" },
  { path: "/ordem-coleta", label: "Ordem de coleta" },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pneusMenuOpen, setPneusMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setPneusMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const isPneusSection = location.pathname.startsWith("/pneus");

  const linkClass = (active) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center whitespace-nowrap ${
      active
        ? "bg-white/10 text-white shadow-sm backdrop-blur-sm border border-white/10"
        : "text-gray-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-primary/95 backdrop-blur-md shadow-lg py-2"
          : "bg-primary py-3 md:py-4"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center group min-w-0">
          <img
            src="/images/ABrotto.png"
            alt="Abbroto Transportadora"
            className="h-10 w-10 object-contain rounded-lg bg-white p-1 mr-3 flex-shrink-0 group-hover:opacity-90 transition-opacity"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-lg md:text-xl font-bold text-white tracking-tight truncate">
              ABroto
            </span>
            <span className="text-[10px] md:text-xs text-gray-400 font-medium uppercase tracking-wider truncate">
              Transportadora
            </span>
          </div>
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-1">
          {mainLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={linkClass(isActive(link.path, link.exact))}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setPneusMenuOpen(true)}
            onMouseLeave={() => setPneusMenuOpen(false)}
          >
            <button
              type="button"
              className={`${linkClass(isPneusSection)} gap-1`}
              aria-expanded={pneusMenuOpen}
              aria-haspopup="true"
            >
              Pneus
              <svg
                className={`w-4 h-4 transition-transform ${pneusMenuOpen ? "rotate-180" : ""}`}
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
              <div className="absolute top-full left-0 mt-1 w-52 py-2 bg-primary-dark border border-white/10 rounded-xl shadow-xl z-50">
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

          <Link
            to="/cadastro-caminhao"
            className="ml-2 px-4 py-2 rounded-lg text-sm font-semibold bg-secondary text-white hover:bg-secondary-dark transition-colors"
          >
            + Caminhão
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="lg:hidden text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-white/10 transition-colors"
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

      {/* Mobile menu */}
      <div
        className={`lg:hidden absolute top-full left-0 right-0 bg-primary border-t border-white/10 shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
          isMobileMenuOpen
            ? "max-h-[85vh] opacity-100 overflow-y-auto"
            : "max-h-0 opacity-0"
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

          <Link
            to="/cadastro-caminhao"
            className="mt-3 mx-4 py-3 rounded-lg text-center font-semibold bg-secondary text-white hover:bg-secondary-dark transition-colors"
          >
            Cadastrar caminhão
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
