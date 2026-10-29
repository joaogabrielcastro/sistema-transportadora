import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Button } from "../ui";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PUBLIC_REGISTER_ENABLED,
} from "../../brand.js";
import SiteFooter from "./SiteFooter.jsx";

const defaultSignup = PUBLIC_REGISTER_ENABLED
  ? "/register?lid=starter"
  : "/login";

export default function SiteLayout({
  children,
  signupHref = defaultSignup,
}) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={PRODUCT_LOGO_SRC}
              alt={PRODUCT_LOGO_ALT}
              className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-bold">{PRODUCT_NAME}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {PRODUCT_TAGLINE}
              </p>
            </div>
          </Link>
          <nav
            className="flex items-center gap-2 sm:gap-4"
            aria-label="Navegação comercial"
          >
            <Link
              to="/#produto"
              className="hidden text-sm font-medium text-text-secondary hover:text-text-primary sm:inline"
            >
              Funcionalidades
            </Link>
            <Link
              to="/planos"
              className="hidden text-sm font-medium text-text-secondary hover:text-text-primary sm:inline"
            >
              Planos
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Entrar
            </Link>
            <Link to={signupHref}>
              <Button variant="secondary" size="sm">
                Começar agora
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

SiteLayout.propTypes = {
  children: PropTypes.node,
  signupHref: PropTypes.string,
};
