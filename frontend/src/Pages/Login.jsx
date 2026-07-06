import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, FormField, Alert } from "../components/ui";
import { parseApiError } from "../lib/apiClient.js";

const MailIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const LockIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const highlights = [
  "Gestão completa da frota",
  "Manutenção e gastos em um só lugar",
  "Ordens de coleta e relatórios",
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const from = location.state?.from || "/";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
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
      {/* Painel da marca — desktop */}
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
            src="/images/ABrotto.png"
            alt=""
            className="h-14 w-14 object-contain rounded-xl bg-white p-1.5 shadow-lg"
          />
          <div>
            <p className="text-2xl font-bold tracking-tight">ABroto</p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Transportadora
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
            Sistema de gestão da sua frota
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Controle caminhões, pneus, manutenções e ordens de coleta com
            praticidade e segurança.
          </p>
          <ul className="space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-light">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-slate-500">
          © {new Date().getFullYear()} ABroto Transportadora
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:px-8 bg-background">
        <div className="w-full max-w-[420px] animate-slide-up">
          {/* Logo mobile */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src="/images/ABrotto.png"
              alt="Abbroto Transportadora"
              className="h-20 w-20 object-contain rounded-2xl bg-white p-2 shadow-card border border-border mb-4"
            />
            <p className="text-xl font-bold text-text-primary">ABroto</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Transportadora
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-border p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                Entrar
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Use seu e-mail e senha para acessar o sistema.
              </p>
            </div>

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

              <Button
                type="submit"
                loading={loading}
                className="w-full py-3 text-base font-semibold"
              >
                Entrar no sistema
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-text-light">
            Acesso restrito a usuários autorizados.
          </p>
        </div>
      </main>
    </div>
  );
}
