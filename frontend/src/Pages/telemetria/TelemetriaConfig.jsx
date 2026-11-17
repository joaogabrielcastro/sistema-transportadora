import React, { useEffect, useState } from "react";
import PageLayout from "../../components/layout/PageLayout.jsx";
import {
  Alert,
  Button,
  Card,
  FormField,
  PageHeader,
  StatCard,
} from "../../components/ui";
import { Link } from "react-router-dom";
import Icon from "../../components/ui/Icon.jsx";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

export default function TelemetriaConfig() {
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.TELEMETRY_WRITE);
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    plan: "basic",
    seat_limit: "10",
    monthly_price: "49",
  });

  const subQuery = useQuery({
    queryKey: [...queryKeys.telemetry.all, "subscription"],
    queryFn: async () =>
      extractApiData(await apiFetch({ url: "/telemetry/subscription" })),
  });

  const protocolsQuery = useQuery({
    queryKey: [...queryKeys.telemetry.all, "protocols"],
    queryFn: async () =>
      extractApiArray(await apiFetch({ url: "/telemetry/protocols" })),
  });

  useEffect(() => {
    const sub = subQuery.data?.subscription;
    if (sub) {
      setForm({
        plan: sub.plan || "basic",
        seat_limit: String(sub.seat_limit ?? 10),
        monthly_price: String(sub.monthly_price ?? 49),
      });
    }
  }, [subQuery.data]);

  const saveMut = useMutation({
    mutationFn: (body) =>
      apiFetch({ method: "PUT", url: "/telemetry/subscription", data: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.telemetry.all });
      setSuccess("Assinatura de telemetria atualizada.");
    },
  });

  const onSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await saveMut.mutateAsync({
        plan: form.plan,
        seat_limit: Number(form.seat_limit) || 0,
        monthly_price: Number(form.monthly_price) || null,
      });
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const usage = subQuery.data?.usage;
  const limits = subQuery.data?.limits;
  const sub = subQuery.data?.subscription;
  // Plano, assentos e preço são dados comerciais: edição restrita a administradores.
  const canEditSubscription = canWrite && user?.role === "admin";
  const seatLimit = usage?.seat_limit ?? sub?.seat_limit ?? null;
  const tracked = usage?.assigned_vehicles ?? 0;
  const seatPct = seatLimit ? Math.min(100, Math.round((tracked / seatLimit) * 100)) : null;
  const PLAN_LABEL = { basic: "Básica", advanced: "Avançada" };
  const PROTOCOL_NAME = { teltonika: "Teltonika (TCP)", http_json: "API ATrack (HTTP)" };

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Telemetria"
          title="Configurações da telemetria"
          subtitle="Uso do módulo, plano contratado, retenção de dados e equipamentos compatíveis."
        />
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard layout="compact" title="Rastreadores ativos" value={usage?.active_devices ?? "—"} color="cyan" icon={<Icon name="device" />} />
          <StatCard layout="compact" title="Veículos rastreados" value={usage?.assigned_vehicles ?? "—"} color="green" icon={<Icon name="truck" />} />
          <div className="card p-4">
            <p className="text-xs font-medium text-text-secondary">Limite do plano</p>
            <p className="text-lg font-semibold tabular-nums text-text-primary">
              {seatLimit ? `${tracked} de ${seatLimit} veículos` : "Sem limite definido"}
            </p>
            {seatPct != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className={`h-full rounded-full ${seatPct >= 90 ? "bg-amber-500" : "bg-cyan-600"}`} style={{ width: `${seatPct}%` }} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Plano do módulo" subtitle={canEditSubscription ? "Valores comerciais do contrato de telemetria." : "Para alterar, fale com o administrador da conta."}>
            {canEditSubscription ? (
              <form onSubmit={onSave} className="grid gap-x-3 sm:grid-cols-3">
                <FormField
                  label="Plano"
                  type="select"
                  name="plan"
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  options={[
                    { value: "basic", label: "Básica" },
                    { value: "advanced", label: "Avançada" },
                  ]}
                />
                <FormField
                  label="Veículos contratados"
                  name="seat_limit"
                  type="number"
                  value={form.seat_limit}
                  onChange={(e) => setForm({ ...form, seat_limit: e.target.value })}
                />
                <FormField
                  label="Preço mensal (R$)"
                  name="monthly_price"
                  type="number"
                  decimals={2}
                  value={form.monthly_price}
                  onChange={(e) => setForm({ ...form, monthly_price: e.target.value })}
                />
                <div className="sm:col-span-3">
                  <Button type="submit" loading={saveMut.isPending}>
                    Salvar plano
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-text-secondary">Plano</dt>
                  <dd className="font-semibold">{sub?.plan ? PLAN_LABEL[sub.plan] || sub.plan : "Não definido"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Veículos</dt>
                  <dd className="font-semibold tabular-nums">{sub?.seat_limit ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Mensalidade</dt>
                  <dd className="font-semibold tabular-nums">
                    {sub?.monthly_price != null
                      ? Number(sub.monthly_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card title="Retenção de dados" subtitle="Por quanto tempo cada informação fica disponível.">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Posições detalhadas (trajeto ponto a ponto)</span>
                <span className="font-semibold tabular-nums">{limits?.rawRetentionDays ? `${limits.rawRetentionDays} dias` : "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Resumo diário (km, consumo, vel. máxima)</span>
                <span className="font-semibold">{limits?.dailySummaryRetention === "indefinite" ? "Sem prazo" : limits?.dailySummaryRetention || "—"}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Última posição de cada veículo</span>
                <span className="font-semibold">{limits?.currentStateRetention === "indefinite" ? "Sem prazo" : limits?.currentStateRetention || "—"}</span>
              </li>
            </ul>
          </Card>
        </div>

        <Card title="Equipamentos compatíveis">
          <ul className="divide-y divide-border">
            {(protocolsQuery.data || []).map((p) => {
              const supported = p.status === "supported";
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{PROTOCOL_NAME[p.id] || p.manufacturer}</p>
                    <details className="text-xs text-text-secondary">
                      <summary className="cursor-pointer select-none hover:text-text-primary">Detalhes técnicos</summary>
                      <p className="mt-1 font-mono">{p.notes}</p>
                    </details>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      supported ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {supported ? "Compatível" : "Em breve"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-text-primary">Consumo e eficiência por veículo</p>
              <p className="text-sm text-text-secondary">
                Km rodados, km/L (telemetria × diesel lançado) e custo por km ficam em Histórico e desempenho.
              </p>
            </div>
            <Link to="/telemetria/historico">
              <Button variant="outline" icon={<Icon name="chart" className="h-4 w-4" />}>
                Abrir desempenho
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}
