import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../brand.js";
import { LEGAL_VERSION, LEGAL_EFFECTIVE_LABEL } from "../legal.js";
import LegalLinks from "./LegalLinks.jsx";

export default function LegalLayout({ title, children }) {
  const { isAuthenticated } = useAuth();
  const backTo = isAuthenticated ? "/" : "/login";
  const backLabel = isAuthenticated ? "Voltar ao sistema" : "Voltar ao login";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to={backTo} className="flex min-w-0 items-center gap-3">
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-bold text-text-primary">{PRODUCT_NAME}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {PRODUCT_TAGLINE}
              </p>
            </div>
          </Link>
          <Link
            to={backTo}
            className="shrink-0 text-sm font-medium text-secondary hover:text-secondary-dark"
          >
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Documento legal · versão {LEGAL_VERSION}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Vigente a partir de {LEGAL_EFFECTIVE_LABEL}.
        </p>
        <article className="mt-8 space-y-6 text-sm leading-relaxed text-text-primary">
          {children}
        </article>
        <LegalLinks className="mt-10 text-sm text-text-secondary" />
      </main>
    </div>
  );
}

LegalLayout.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};
