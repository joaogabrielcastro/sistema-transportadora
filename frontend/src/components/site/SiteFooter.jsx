import React from "react";
import { Link } from "react-router-dom";
import {
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from "../../brand.js";
import { LEGAL_CONTACT_EMAIL } from "../../legal.js";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-primary text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-3">
            <img
              src={PRODUCT_LOGO_SRC}
              alt=""
              className="h-10 w-10 rounded-lg bg-white object-contain p-1"
            />
            <div>
              <p className="font-bold text-white">{PRODUCT_NAME}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {PRODUCT_TAGLINE}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Sistema para transportadoras controlar frota, gastos, manutenção,
            documentos e operação no dia a dia.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            {PRODUCT_NAME}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-white">
                Sobre
              </Link>
            </li>
            <li>
              <a href="/#produto" className="hover:text-white">
                Funcionalidades
              </a>
            </li>
            <li>
              <Link to="/planos" className="hover:text-white">
                Planos
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            Suporte
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              {LEGAL_CONTACT_EMAIL ? (
                <a
                  href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                  className="hover:text-white"
                >
                  Contato
                </a>
              ) : (
                <a href="/#faq" className="hover:text-white">
                  Contato
                </a>
              )}
            </li>
            <li>
              <a href="/#faq" className="hover:text-white">
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            Legal
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/termos" className="hover:text-white">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-white">
                Política de privacidade
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {PRODUCT_NAME}. {PRODUCT_TAGLINE}.
          </p>
          {LEGAL_CONTACT_EMAIL ? (
            <p>{LEGAL_CONTACT_EMAIL}</p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}