import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormField, Alert } from "../components/ui";
import AuthShell from "../components/AuthShell.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch({
        method: "POST",
        url: "/auth/forgot-password",
        data: { email },
      });
      setSent(true);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível enviar o e-mail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Esqueci a senha"
      subtitle="Informe o e-mail da conta. Se estiver cadastrado, você recebe um link para definir uma nova senha."
    >
      {error && <Alert type="error" message={error} className="mb-5" />}
      {sent ? (
        <Alert
          type="success"
          message="Se este e-mail estiver cadastrado, enviaremos as instruções em instantes. Confira também a caixa de spam."
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField
            label="E-mail"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="username"
          />
          <Button type="submit" loading={loading} className="w-full py-3">
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-text-secondary">
        Lembrou a senha?{" "}
        <Link to="/login" className="font-semibold text-secondary hover:text-secondary-dark">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
