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

  const efficiencyQuery = useQuery({
    queryKey: [...queryKeys.telemetry.all, "efficiency"],
    queryFn: async () =>
      extractApiData(await apiFetch({ url: "/telemetry/reports/efficiency" })),
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

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Configurações"
          subtitle="Assentos do módulo, protocolos suportados e eficiência."
        />
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard title="Devices ativos" value={usage?.active_devices ?? "—"} />
          <StatCard title="Veículos vinculados" value={usage?.assigned_vehicles ?? "—"} />
          <StatCard title="Limite de seats" value={usage?.seat_limit ?? "—"} />
        </div>

        {canWrite && (
          <Card title="Assinatura do módulo">
            <form onSubmit={onSave} className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">Plano</span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                >
                  <option value="basic">Básica</option>
                  <option value="advanced">Avançada</option>
                </select>
              </label>
              <FormField
                label="Seats (veículos)"
                name="seat_limit"
                value={form.seat_limit}
                onChange={(e) =>
                  setForm({ ...form, seat_limit: e.target.value })
                }
              />
              <FormField
                label="Preço mensal (R$)"
                name="monthly_price"
                value={form.monthly_price}
                onChange={(e) =>
                  setForm({ ...form, monthly_price: e.target.value })
                }
              />
              <div className="md:col-span-3">
                <Button type="submit" disabled={saveMut.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card title="Protocolos">
          <ul className="divide-y divide-border">
            {(protocolsQuery.data || []).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{p.manufacturer}</p>
                  <p className="text-xs text-text-secondary">{p.notes}</p>
                </div>
                <span className="text-xs uppercase text-text-secondary">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Eficiência (telemetria × combustível lançado)"
          subtitle={efficiencyQuery.data?.note}
        >
          {!efficiencyQuery.data?.vehicles?.length ? (
            <p className="text-sm text-text-secondary">
              Sem dados diários no período. Medições CAN/consumo só aparecem quando
              o equipamento envia.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {efficiencyQuery.data.vehicles.map((v) => (
                <li key={v.caminhao_id} className="py-2">
                  <p className="font-medium">{v.placa || `#${v.caminhao_id}`}</p>
                  <p className="text-xs text-text-secondary">
                    KM telemetria: {Number(v.km || 0).toFixed(1)}
                    {" · "}
                    Comb. telemetria:{" "}
                    {v.fuel_telemetry_l != null
                      ? `${Number(v.fuel_telemetry_l).toFixed(1)} L`
                      : "indisponível"}
                    {" · "}
                    Comb. manual:{" "}
                    {v.fuel_manual_l != null
                      ? `${Number(v.fuel_manual_l).toFixed(1)} L`
                      : "—"}
                    {" · "}
                    Custo/km:{" "}
                    {v.cost_per_km != null
                      ? `R$ ${Number(v.cost_per_km).toFixed(2)}`
                      : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
