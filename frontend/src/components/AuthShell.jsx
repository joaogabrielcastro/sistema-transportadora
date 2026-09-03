import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../brand.js";
import LegalLinks from "./LegalLinks.jsx";

const DEFAULT_HIGHLIGHTS = [
  "Frota, documentos e composição em um painel",
  "Pneus, estoque e vida útil sob controle",
  "Custos, manutenção e relatórios de custo/km",
];

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  highlights = DEFAULT_HIGHLIGHTS,
  asideTitle = "Sua frota sob controle, do pátio ao relatório",
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden bg-primary text-white flex-col justify-between p-10 xl:p-14">
        <div
          className="absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(148,163,184,0.15) 0%, transparent 45%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4">
          <img
            src={PRODUCT_LOGO_SRC}
            alt=""
            className="h-14 w-14 object-contain rounded-xl bg-white p-1.5 shadow-lg"
          />
          <div>
            <p className="text-2xl font-bold tracking-tight text-white">
              {PRODUCT_NAME}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {PRODUCT_TAGLINE}
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight text-white">
            {asideTitle}
          </h2>
          <ul className="space-y-3.5">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-200">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-light">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-slate-500">
          © {new Date().getFullYear()} {PRODUCT_NAME} {PRODUCT_TAGLINE}
        </p>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-8 bg-background">
        <div className="w-full max-w-[420px] animate-slide-up">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-20 w-20 object-contain rounded-2xl bg-white p-2 shadow-card border border-border mb-4"
            />
            <p className="text-xl font-bold text-text-primary">{PRODUCT_NAME}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {PRODUCT_TAGLINE}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-border p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
              )}
            </div>
            {children}
          </div>

          {footer ?? (
            <div className="mt-6 text-center">
              <p className="text-xs text-text-light">
                <Link to="/login" className="font-medium text-secondary hover:text-secondary-dark">
                  Voltar ao login
                </Link>
              </p>
              <LegalLinks className="mt-3 text-center text-xs text-text-light" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

AuthShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node,
  highlights: PropTypes.arrayOf(PropTypes.string),
  asideTitle: PropTypes.string,
};
