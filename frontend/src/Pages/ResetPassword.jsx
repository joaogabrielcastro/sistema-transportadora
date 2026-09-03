import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, FormField, Alert } from "../components/ui";
import AuthShell from "../components/AuthShell.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch({
        method: "POST",
        url: "/auth/reset-password",
        data: { token, password },
      });
      setDone(true);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível atualizar a senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Nova senha"
      subtitle="Defina uma senha com no mínimo 8 caracteres."
    >
      {!token ? (
        <Alert
          type="error"
          message="Link incompleto. Solicite um novo e-mail de recuperação."
        />
      ) : done ? (
        <>
          <Alert type="success" message="Senha atualizada. Entre com a nova senha." />
          <Link to="/login" className="mt-6 block">
            <Button className="w-full py-3">Ir para o login</Button>
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Alert type="error" message={error} />}
          <FormField
            label="Nova senha"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
          <FormField
            label="Confirmar senha"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full py-3">
            Salvar senha
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
