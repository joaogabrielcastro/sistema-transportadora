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
import BrazilOpsMap from "./BrazilOpsMap.jsx";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="min-h-screen flex">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-8 bg-white lg:bg-background">
        <div className="w-full max-w-[420px] animate-slide-up">
          <div className="flex flex-col items-center text-center mb-8 lg:items-start lg:text-left">
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-16 w-16 object-contain rounded-2xl bg-white p-2 shadow-card border border-border mb-4"
            />
            <p className="text-xl font-bold text-text-primary">{PRODUCT_NAME}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {PRODUCT_TAGLINE}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-border p-6 sm:p-8 lg:shadow-none lg:border-0 lg:p-0">
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
            <div className="mt-6 text-center lg:text-left">
              <p className="text-xs text-text-light">
                <Link to="/login" className="font-medium text-secondary hover:text-secondary-dark">
                  Voltar ao login
                </Link>
              </p>
              <LegalLinks className="mt-3 text-center text-xs text-text-light lg:text-left" />
            </div>
          )}
        </div>
      </main>

      <aside
        className="hidden lg:flex lg:w-[52%] xl:w-[54%] relative overflow-hidden border-l border-border"
        aria-hidden
      >
        <BrazilOpsMap />
      </aside>
    </div>
  );
}

AuthShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node,
};
