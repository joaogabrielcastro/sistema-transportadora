import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, FormField, Alert } from "../components/ui";
import { parseApiError } from "../lib/apiClient.js";
import {
  PRODUCT_LOGO_ALT,
  PRODUCT_LOGO_SRC,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PUBLIC_REGISTER_ENABLED,
} from "../brand.js";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import LegalAcceptCheckbox from "../components/LegalAcceptCheckbox.jsx";
import LegalLinks from "../components/LegalLinks.jsx";

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const [empresaNome, setEmpresaNome] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  if (!PUBLIC_REGISTER_ENABLED) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedLegal) {
      setError("É necessário aceitar os termos de uso e a política de privacidade");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await register({ empresaNome, email, password, nome, acceptedLegal });
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  };

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
            <p className="text-2xl font-bold tracking-tight text-white">{PRODUCT_NAME}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {PRODUCT_TAGLINE}
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight text-white">
            Comece a organizar a frota da sua empresa
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Crie o espaço da transportadora em minutos e acompanhe veículos,
            pneus e custos com dados isolados da sua operação.
          </p>
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
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-border p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                Criar conta
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Informe os dados da empresa e do administrador.
              </p>
            </div>

            {error && <Alert type="error" message={error} className="mb-5" />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                label="Nome da empresa"
                name="empresaNome"
                type="text"
                value={empresaNome}
                onChange={(e) => setEmpresaNome(e.target.value)}
                placeholder="Ex.: Transportes Silva"
                required
                maxLength={FIELD_LIMITS.EMPRESA_NOME}
                autoComplete="organization"
              />

              <FormField
                label="Seu nome"
                name="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Administrador"
                maxLength={FIELD_LIMITS.NOME}
                autoComplete="name"
              />

              <FormField
                label="E-mail"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@empresa.com"
                required
                autoComplete="username"
              />

              <div>
                <FormField
                  label="Senha"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={FIELD_LIMITS.PASSWORD_MIN}
                  maxLength={FIELD_LIMITS.PASSWORD_MAX}
                  autoComplete="new-password"
                  className="mb-0"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs font-medium text-secondary hover:text-secondary-dark transition-colors"
                  >
                    {showPassword ? "Ocultar senha" : "Mostrar senha"}
                  </button>
                </div>
              </div>

              <LegalAcceptCheckbox
                checked={acceptedLegal}
                onChange={setAcceptedLegal}
              />

              <Button
                type="submit"
                loading={loading}
                className="w-full py-3 text-base font-semibold"
              >
                Criar conta e entrar
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              Já tem conta?{" "}
              <Link
                to="/login"
                className="font-semibold text-secondary hover:text-secondary-dark"
              >
                Entrar
              </Link>
            </p>
          </div>
          <LegalLinks />
          <p className="mt-3 text-center text-xs text-text-light">
            <Link to="/" className="font-medium text-secondary hover:text-secondary-dark">
              Conhecer o ATrack
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
