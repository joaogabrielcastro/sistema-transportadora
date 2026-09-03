import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, FormField, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";

export default function Conta() {
  const { user } = useAuth();
  const canWriteSettings = userHasPermission(user, PERMISSIONS.SETTINGS_WRITE);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch({
        method: "POST",
        url: "/auth/change-password",
        data: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSuccess("Senha atualizada com sucesso.");
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível alterar a senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Minha conta"
        subtitle="Altere a senha do seu acesso. Isso não desconecta outras sessões já abertas."
      />

      <section className="bg-white border border-border rounded-2xl shadow-card p-5 sm:p-6 max-w-lg">
        <p className="text-sm text-text-secondary mb-5">
          Conectado como <strong>{user?.nome}</strong> ({user?.email}).
        </p>
        {error && <Alert type="error" message={error} className="mb-4" />}
        {success && <Alert type="success" message={success} className="mb-4" />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Senha atual"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <FormField
            label="Nova senha"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
          <FormField
            label="Confirmar nova senha"
            name="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading}>
            Atualizar senha
          </Button>
        </form>
        {canWriteSettings && (
          <p className="mt-6 text-sm">
            <Link
              to="/empresa"
              className="font-semibold text-secondary hover:text-secondary-dark"
            >
              Dados da empresa
            </Link>
          </p>
        )}
        <p className="mt-6 text-xs text-text-secondary">
          <Link to="/termos" className="font-medium text-secondary hover:text-secondary-dark">
            Termos de uso
          </Link>
          <span className="mx-1.5">·</span>
          <Link to="/privacidade" className="font-medium text-secondary hover:text-secondary-dark">
            Política de privacidade
          </Link>
        </p>
      </section>
    </PageLayout>
  );
}
