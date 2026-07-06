import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Button, Card, FormField, Alert } from "../components/ui";
import { parseApiError } from "../lib/apiClient.js";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <PageLayout className="max-w-md mx-auto mt-16">
      <Card>
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/images/ABrotto.png"
            alt="Abbroto Transportadora"
            className="h-16 w-16 object-contain rounded-xl bg-white p-1.5 shadow-sm border border-border mb-3"
          />
          <p className="text-lg font-bold text-text-primary tracking-tight">
            ABroto
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Transportadora
          </p>
        </div>

        <h1 className="text-xl font-bold text-text-primary mb-1 text-center">
          Entrar
        </h1>
        <p className="text-sm text-text-secondary mb-6 text-center">
          Acesso ao sistema de gestão
        </p>

        {error && <Alert type="error" message={error} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="E-mail"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <FormField
            label="Senha"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </PageLayout>
  );
}
