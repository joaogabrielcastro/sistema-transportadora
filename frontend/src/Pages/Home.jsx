import React, { lazy, Suspense, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  useCostPerKmReportQuery,
  useCostPerKmTrendQuery,
  useOpsAlertsQuery,
  useReportsOverviewQuery,
} from "../hooks";
import { useTelemetryCurrentQuery } from "../hooks/queries/useTelemetryQueries.js";
import { Button, PageHeader, StatCard } from "../components/ui";
import Icon from "../components/ui/Icon.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import { formatCurrency, formatNumber, lastMonthsIsoRange } from "../utils";
import { CardSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import OnboardingBanner from "../components/OnboardingBanner.jsx";
import PlanQuotaBanner from "../components/PlanQuotaBanner.jsx";
import OpsAlertsPanel from "../components/dashboard/OpsAlertsPanel.jsx";
import { quickActionsFor } from "../components/layout/quickActions.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { isVehicleQuotaReached } from "../utils/billing.js";
import { VEHICLE_STATUS, vehicleStatus } from "../utils/telemetryDisplay.js";

const DashboardCharts = lazy(
  () => import("../components/dashboard/DashboardCharts.jsx"),
);

/** Parâmetros da antiga lista da frota no painel — agora vivem em /frota. */
const LEGACY_FLEET_PARAMS = ["busca", "tipo", "pagina"];
const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function todayLabel(date = new Date()) {
  const s = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Card "Frota agora" (telemetria): quantos estão rodando, parados ligados e sem sinal. */
function FleetNowCard({ rows, loading }) {
  const counts = useMemo(() => {
    const c = { moving: 0, idle: 0, off: 0, offline: 0 };
    for (const r of rows) {
      const st = vehicleStatus({
        connection: r.connection_status,
        speedKmh: r.velocidade_kmh != null ? Number(r.velocidade_kmh) : null,
        ignition: r.ignicao,
      });
      if (st === "awaiting" || st === "offline") c.offline += 1;
      else c[st] += 1;
    }
    return c;
  }, [rows]);

  const items = [
    { key: "moving", label: "Em movimento", value: counts.moving },
    { key: "idle", label: "Parados ligados", value: counts.idle },
    { key: "off", label: "Desligados", value: counts.off },
    { key: "offline", label: "Sem sinal", value: counts.offline },
  ];

  return (
    <Link
      to="/telemetria"
      className="card group block p-4 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Frota agora
        </p>
        <span className="text-xs font-semibold text-secondary-dark group-hover:text-secondary">Abrir mapa →</span>
      </div>
      {loading ? (
        <div className="mt-3 h-12 animate-pulse rounded bg-slate-100" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">Nenhum veículo com rastreador vinculado.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-4 gap-2">
          {items.map((it) => (
            <div key={it.key}>
              <dt className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <span className={`h-1.5 w-1.5 rounded-full ${VEHICLE_STATUS[it.key].dot}`} aria-hidden />
                <span className="truncate">{it.label}</span>
              </dt>
              <dd className={`text-xl font-semibold tabular-nums ${it.key === "offline" && it.value ? "text-red-700" : "text-text-primary"}`}>
                {it.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}

const Home = () => {
  const location = useLocation();
  const { user } = useAuth();
  const canWriteFrota = userHasPermission(user, PERMISSIONS.FROTA_WRITE);
  const canReadReports = userHasPermission(user, PERMISSIONS.REPORTS_READ);
  const canReadAlerts = userHasPermission(user, PERMISSIONS.ALERTS_READ);
  const canSeeTelemetry =
    user?.features?.telemetria === true && userHasPermission(user, PERMISSIONS.TELEMETRY_READ);
  const vehicleQuotaReached = isVehicleQuotaReached(user);
  const actions = useMemo(() => quickActionsFor(user), [user]);

  const { data: overview, isLoading: overviewLoading, error: overviewError } =
    useReportsOverviewQuery();
  const dashboardRange = useMemo(() => lastMonthsIsoRange(6), []);
  const costParams = useMemo(() => ({ ...dashboardRange, entriesLimit: 1 }), [dashboardRange]);
  const trendQuery = useCostPerKmTrendQuery(dashboardRange, canReadReports);
  const costQuery = useCostPerKmReportQuery(costParams, canReadReports);
  const alertsQuery = useOpsAlertsQuery(canReadAlerts);
  const telemetryQuery = useTelemetryCurrentQuery({}, { enabled: canSeeTelemetry, refetchInterval: 60_000 });

  // Compatibilidade: links antigos "/?busca=…&tipo=…" abrem a lista da frota.
  const legacy = new URLSearchParams(location.search);
  if (LEGACY_FLEET_PARAMS.some((k) => legacy.get(k))) {
    return <Navigate to={`/frota?${legacy.toString()}`} replace />;
  }

  const totalCaminhoes = overview?.totalCaminhoes ?? 0;
  const semMotorista = overview?.semMotorista;
  const firstName = String(user?.nome || "").trim().split(/\s+/)[0];
  const noVehicles = !overviewLoading && !overviewError && totalCaminhoes === 0;

  // Custo do mês corrente (parcial) e do mês anterior, a partir da série mensal.
  const months = trendQuery.data?.months || [];
  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const monthName = thisMonth?.month ? MONTHS_PT[Number(String(thisMonth.month).slice(5, 7)) - 1] : null;
  const avgCostPerKm = costQuery.data?.stats?.avgCostPerKm;

  return (
    <PageLayout className="space-y-6">
      <OnboardingBanner />

      <PageHeader
        eyebrow={todayLabel()}
        title={firstName ? `${greeting()}, ${firstName}` : "Painel"}
        subtitle="O que precisa de atenção hoje e como estão os custos da operação."
        actions={
          actions.length ? (
            <>
              {actions.slice(0, 2).map((a, i) => (
                <Link key={a.id} to={a.to}>
                  <Button variant={i === 0 ? "primary" : "outline"} icon={<Icon name={a.icon} className="h-4 w-4" />}>
                    {a.label}
                  </Button>
                </Link>
              ))}
            </>
          ) : null
        }
      />

      <PlanQuotaBanner user={user} resource="vehicles" />

      {noVehicles ? (
        <EmptyState
          icon={<Icon name="truck" className="h-5 w-5" />}
          title="Comece cadastrando a sua frota"
          description="Com os veículos cadastrados, o painel passa a mostrar custos, vencimentos e pendências."
          action={
            canWriteFrota ? (
              <Link to={vehicleQuotaReached ? "/assinatura" : "/cadastro-caminhao"}>
                <Button>{vehicleQuotaReached ? "Fazer upgrade" : "Cadastrar veículo"}</Button>
              </Link>
            ) : null
          }
        />
      ) : null}

      <section aria-labelledby="resumo-operacional">
        <h2 id="resumo-operacional" className="sr-only">Resumo operacional</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {canReadReports ? (
            <StatCard
              title={monthName ? `Custo em ${monthName}` : "Custo no mês"}
              value={trendQuery.error ? "Indisponível" : formatCurrency(thisMonth?.totalCost ?? 0)}
              loading={trendQuery.isLoading}
              hint={prevMonth ? `Mês anterior: ${formatCurrency(prevMonth.totalCost ?? 0)}` : "Gastos + manutenções"}
              color="green"
              to="/relatorios"
              icon={<Icon name="money" />}
            />
          ) : null}
          {canReadReports ? (
            <StatCard
              title="Custo por km"
              value={
                costQuery.error
                  ? "Indisponível"
                  : avgCostPerKm != null && Number.isFinite(Number(avgCostPerKm)) && Number(avgCostPerKm) > 0
                    ? `${Number(avgCostPerKm).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                    : "—"
              }
              loading={costQuery.isLoading}
              hint="Média da frota nos últimos 6 meses"
              color="cyan"
              to="/relatorios"
              icon={<Icon name="gauge" />}
            />
          ) : null}
          <StatCard
            title="Veículos"
            value={overviewError ? "Indisponível" : formatNumber(totalCaminhoes)}
            loading={overviewLoading}
            hint={
              semMotorista != null
                ? semMotorista > 0
                  ? `${semMotorista} sem motorista`
                  : "Todos com motorista"
                : "Veículos cadastrados"
            }
            color="slate"
            to="/frota"
            icon={<Icon name="truck" />}
          />
        </div>
      </section>

      {canSeeTelemetry ? (
        <FleetNowCard rows={telemetryQuery.data || []} loading={telemetryQuery.isLoading} />
      ) : null}

      {canReadAlerts ? (
        <section id="pendencias" className="scroll-mt-24" aria-label="Pendências da operação">
          <OpsAlertsPanel
            data={alertsQuery.data}
            isLoading={alertsQuery.isLoading}
            error={alertsQuery.error}
            onRetry={() => alertsQuery.refetch()}
          />
        </section>
      ) : null}

      {canReadReports ? (
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <CardSkeleton />
              </div>
              <CardSkeleton />
            </div>
          }
        >
          <DashboardCharts
            trendMonths={months}
            trendLoading={trendQuery.isLoading}
            truckCosts={costQuery.data?.items}
            truckCostsLoading={costQuery.isFetching}
          />
        </Suspense>
      ) : null}
    </PageLayout>
  );
};

export default Home;
