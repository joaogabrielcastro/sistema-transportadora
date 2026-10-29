import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, FormField, Alert } from "../components/ui";
import { parseApiError } from "../lib/apiClient.js";
import { resolvePostLoginRedirect } from "../utils/safeRedirect.js";
import { assinaturaHref, readStoredLid, registerHref } from "../utils/planLid.js";
import { trackFunnel } from "../utils/funnel.js";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PUBLIC_REGISTER_ENABLED,
} from "../brand.js";
import LegalLinks from "../components/LegalLinks.jsx";
import BrazilOpsMap from "../components/BrazilOpsMap.jsx";

const MailIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const LockIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const from = resolvePostLoginRedirect(location);
  const [accountClosed] = useState(() => {
    if (location.state?.closed === true) return true;
    try {
      const flagged = sessionStorage.getItem("atrack.accountClosed") === "1";
      if (flagged) sessionStorage.removeItem("atrack.accountClosed");
      return flagged;
    } catch {
      return false;
    }
  });

  if (isAuthenticated) {
    const lid = readStoredLid();
    const dest =
      from && from !== "/"
        ? from
        : lid
          ? assinaturaHref(lid)
          : "/";
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      trackFunnel("login_start", { lid: readStoredLid() });
      await login(email, password);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

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
                Entrar
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Acesse a operação da sua transportadora.
              </p>
            </div>

            {accountClosed && (
              <Alert
                type="info"
                className="mb-5"
                message="Empresa encerrada. O acesso desta conta foi desativado."
              />
            )}
            {error && <Alert type="error" message={error} className="mb-5" />}

            <form onSubmit={handleSubmit} className="space-y-1">
              <FormField
                label="E-mail"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="username"
                icon={<MailIcon />}
                className="mb-5"
              />

              <div className="mb-6">
                <FormField
                  label="Senha"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  icon={<LockIcon />}
                  className="mb-0"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Link
                    to="/forgot-password"
                    className="inline-flex min-h-10 items-center text-xs font-medium text-secondary transition-colors hover:text-secondary-dark"
                  >
                    Esqueci a senha
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    className="inline-flex min-h-10 items-center text-xs font-medium text-secondary transition-colors hover:text-secondary-dark"
                  >
                    {showPassword ? "Ocultar senha" : "Mostrar senha"}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full py-3 text-base font-semibold"
              >
                Entrar
              </Button>
            </form>

            {PUBLIC_REGISTER_ENABLED && (
              <p className="mt-6 text-center text-sm text-text-secondary lg:text-left">
                Nova empresa?{" "}
                <Link
                  to={registerHref(readStoredLid())}
                  className="font-semibold text-secondary hover:text-secondary-dark"
                >
                  Criar conta
                </Link>
              </p>
            )}
          </div>

          <LegalLinks />
          <p className="mt-3 text-center text-xs text-text-light lg:text-left">
            <Link to="/" className="font-medium text-secondary hover:text-secondary-dark">
              Conhecer o ATrack
            </Link>
          </p>
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
