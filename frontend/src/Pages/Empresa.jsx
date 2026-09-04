import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, FormField, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import {
  formatQuotaUsage,
  planDisplayName,
} from "../utils/billing.js";
import { legalContactLabel } from "../legal.js";

export default function Empresa() {
  const { user, refreshProfile, logout, isAuthenticated } = useAuth();
  const canManage = userHasPermission(user, PERMISSIONS.SETTINGS_WRITE);

  const [settings, setSettings] = useState(null);
  const [nome, setNome] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [whatsappNotifyPhone, setWhatsappNotifyPhone] = useState("");
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch({ url: "/tenant" });
      const data = res.data ?? res;
      setSettings(data);
      setNome(data.nome || "");
      setAlertEmail(data.alertEmail || "");
      setWhatsappNotifyPhone(data.whatsappNotifyPhone || "");
      setWeeklyDigestEnabled(data.weeklyDigestEnabled !== false);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao carregar dados da empresa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!canManage) {
    return <Navigate to="/" replace />;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch({
        method: "PATCH",
        url: "/tenant",
        data: {
          nome,
          alertEmail,
          whatsappNotifyPhone,
          weeklyDigestEnabled,
        },
      });
      const data = res.data ?? res;
      setSettings(data);
      setNome(data.nome || "");
      setAlertEmail(data.alertEmail || "");
      setWhatsappNotifyPhone(data.whatsappNotifyPhone || "");
      setWeeklyDigestEnabled(data.weeklyDigestEnabled !== false);
      setSuccess("Dados da empresa atualizados.");
      await refreshProfile?.();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    setClosing(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch({
        method: "POST",
        url: "/tenant/close",
        data: { confirmName },
      });
      try {
        sessionStorage.setItem("atrack.accountClosed", "1");
      } catch {
        /* ignore */
      }
      logout();
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Não foi possível encerrar a empresa");
      setClosing(false);
    }
  };

  const quota = settings?.quota;
  const savedNome = settings?.nome || "";
  const nameOk =
    confirmName.trim().toLowerCase() ===
      String(savedNome).trim().toLowerCase() &&
    confirmName.trim().length >= 2;

  return (
    <PageLayout narrow className="space-y-6">
      <PageHeader
        title="Empresa"
        subtitle="Nome, plano, avisos e encerramento da conta."
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {loading ? (
        <p className="text-sm text-text-secondary">Carregando…</p>
      ) : (
        <>
          <section className="bg-white border border-border rounded-2xl shadow-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Dados da empresa
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Identificador: <code className="text-xs">{settings?.slug}</code>
              {settings?.criadoEm
                ? ` · desde ${new Date(settings.criadoEm).toLocaleDateString("pt-BR")}`
                : ""}
            </p>
            <form onSubmit={handleSave} className="space-y-4">
              <FormField
                label="Nome da empresa"
                name="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              <FormField
                label="E-mail para alertas e resumo semanal"
                name="alertEmail"
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="financeiro@empresa.com"
                helperText="Se vazio, o resumo vai para o e-mail de um administrador."
              />
              <FormField
                label="WhatsApp para avisos (opcional)"
                name="whatsappNotifyPhone"
                value={whatsappNotifyPhone}
                onChange={(e) => setWhatsappNotifyPhone(e.target.value)}
                placeholder="5548999999999"
                helperText="Número com DDI, só dígitos. Usado em resumo e ordem de coleta, se o WhatsApp estiver configurado."
              />
              <label className="flex items-start gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border"
                  checked={weeklyDigestEnabled}
                  onChange={(e) => setWeeklyDigestEnabled(e.target.checked)}
                />
                <span>Receber resumo semanal de alertas por e-mail</span>
              </label>
              <Button type="submit" loading={saving}>
                Salvar
              </Button>
            </form>
          </section>

          <section className="bg-white border border-border rounded-2xl shadow-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              Plano e uso
            </h2>
            <p className="text-sm text-text-secondary mb-3">
              {settings?.billingExempt
                ? "Esta empresa está isenta de cobrança."
                : `Plano ${planDisplayName(settings?.plan)} · situação: ${
                    settings?.subscriptionStatus || "—"
                  }`}
            </p>
            {quota && !quota.unlimited && (
              <p className="text-sm text-text-primary mb-3">
                Uso:{" "}
                <strong>{formatQuotaUsage(quota.vehicles)}</strong> veículos ·{" "}
                <strong>{formatQuotaUsage(quota.users)}</strong> usuários
                {quota.users?.pendingInvites > 0
                  ? ` (inclui ${quota.users.pendingInvites} convite(s) pendente(s))`
                  : ""}
                .
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {!settings?.billingExempt && (
                <Link
                  to="/assinatura"
                  className="text-sm font-semibold text-secondary hover:text-secondary-dark"
                >
                  Ver planos e pagamento
                </Link>
              )}
              <Link
                to="/usuarios"
                className="text-sm font-semibold text-secondary hover:text-secondary-dark"
              >
                Gerenciar usuários
              </Link>
            </div>
            <p className="mt-4 text-xs text-text-secondary leading-relaxed">
              Para uma cópia dos seus dados (LGPD), escreva para{" "}
              {legalContactLabel()}. Encerrar a conta abaixo desativa o acesso;
              não apaga automaticamente o histórico da frota.
            </p>
          </section>

          {settings?.canClose ? (
            <section className="bg-white border border-red-200 rounded-2xl shadow-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-1">
                Encerrar empresa
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Ninguém desta empresa poderá entrar de novo. A assinatura é
                cancelada se existir. Digite o nome da empresa para confirmar.
              </p>
              <form onSubmit={handleClose} className="space-y-4">
                <FormField
                  label={`Digite "${savedNome}" para confirmar`}
                  name="confirmName"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoComplete="off"
                  required
                />
                <Button
                  type="submit"
                  variant="danger"
                  loading={closing}
                  disabled={!nameOk}
                >
                  Encerrar empresa
                </Button>
              </form>
            </section>
          ) : settings?.billingExempt ? (
            <Alert type="info">
              Contas isentas não são encerradas por esta tela. Fale com o
              suporte se precisar desativar o acesso.
            </Alert>
          ) : null}
        </>
      )}
    </PageLayout>
  );
}
