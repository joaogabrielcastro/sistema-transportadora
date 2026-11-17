import React, { lazy, Suspense, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  useCaminhoesListQuery,
  useCostPerKmReportQuery,
  useCostPerKmTrendQuery,
  useOpsAlertsQuery,
  useReportsOverviewQuery,
} from "../hooks";
import { useCaminhaoDelete } from "../hooks/useCaminhaoDelete.js";
import { Alert, Button, Card, PageHeader, StatCard } from "../components/ui";
import Icon from "../components/ui/Icon.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import { formatCurrency, formatNumber, lastMonthsIsoRange } from "../utils";
import ConfirmModal from "../components/ConfirmModal";
import { CardSkeleton, TableSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import OnboardingBanner from "../components/OnboardingBanner.jsx";
import PlanQuotaBanner from "../components/PlanQuotaBanner.jsx";
import OpsAlertsPanel from "../components/dashboard/OpsAlertsPanel.jsx";
import FleetTable from "../components/frota/FleetTable.jsx";
import { quickActionsFor } from "../components/layout/quickActions.js";
import { useAuth } from "../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../utils/permissions.js";
import { isVehicleQuotaReached } from "../utils/billing.js";

const DashboardCharts = lazy(
  () => import("../components/dashboard/DashboardCharts.jsx"),
);

const FLEET_PREVIEW = 8;
/** Parâmetros da antiga lista da frota no painel — agora vivem em /frota. */
const LEGACY_FLEET_PARAMS = ["busca", "tipo", "pagina"];

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

const Home = () => {
  const location = useLocation();
  const { user } = useAuth();
  const canWriteFrota = userHasPermission(user, PERMISSIONS.FROTA_WRITE);
  const canReadReports = userHasPermission(user, PERMISSIONS.REPORTS_READ);
  const canReadAlerts = userHasPermission(user, PERMISSIONS.ALERTS_READ);
  const vehicleQuotaReached = isVehicleQuotaReached(user);
  const actions = useMemo(() => quickActionsFor(user), [user]);

  const fleetQuery = useCaminhoesListQuery({ page: 1, limit: FLEET_PREVIEW });
  const caminhoes = fleetQuery.data?.data ?? [];
  const pagination = fleetQuery.data?.pagination;

  const { data: overview, isLoading: overviewLoading, error: overviewError } =
    useReportsOverviewQuery();
  const dashboardRange = useMemo(() => lastMonthsIsoRange(6), []);
  const costParams = useMemo(() => ({ ...dashboardRange, entriesLimit: 1 }), [dashboardRange]);
  const trendQuery = useCostPerKmTrendQuery(dashboardRange, canReadReports);
  const costQuery = useCostPerKmReportQuery(costParams, canReadReports);
  const alertsQuery = useOpsAlertsQuery(canReadAlerts);
  const del = useCaminhaoDelete();

  // Compatibilidade: links antigos "/?busca=…&tipo=…" abrem a lista da frota.
  const legacy = new URLSearchParams(location.search);
  if (LEGACY_FLEET_PARAMS.some((k) => legacy.get(k))) {
    return <Navigate to={`/frota?${legacy.toString()}`} replace />;
  }

  const totalCaminhoes = overview?.totalCaminhoes ?? pagination?.totalItems ?? caminhoes.length ?? 0;
  const semMotorista = overview?.semMotorista;
  const counts = alertsQuery.data?.counts;
  const urgent = (counts?.critical ?? 0) + (counts?.high ?? 0);
  const overviewValue = (fn) => (overviewError ? "Indisponível" : fn());
  const firstName = String(user?.nome || "").trim().split(/\s+/)[0];

  return (
    <PageLayout className="space-y-6">
      <OnboardingBanner />

      <PageHeader
        eyebrow={todayLabel()}
        title={firstName ? `${greeting()}, ${firstName}` : "Painel"}
        subtitle="Visão geral da operação: pendências, custos e situação da frota."
        actions={
          actions.length ? (
            <>
              {actions.slice(0, 2).map((a, i) => (
                <Link key={a.id} to={a.to}>
                  <Button
                    variant={i === 0 ? "primary" : "outline"}
                    icon={<Icon name={a.icon} className="h-4 w-4" />}
                  >
                    {a.label}
                  </Button>
                </Link>
              ))}
            </>
          ) : null
        }
      />

      <PlanQuotaBanner user={user} resource="vehicles" />

      {del.blockedMessage ? (
        <Alert
          type="error"
          message={<span className="whitespace-pre-line">{del.blockedMessage}</span>}
          onClose={del.clearBlocked}
        />
      ) : null}

      <section aria-labelledby="resumo-operacional">
        <h2 id="resumo-operacional" className="sr-only">Resumo operacional</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            title="Veículos"
            value={formatNumber(totalCaminhoes)}
            loading={overviewLoading && fleetQuery.isLoading}
            hint={
              semMotorista != null
                ? semMotorista > 0
                  ? `${semMotorista} sem motorista`
                  : "Todos com motorista"
                : "Veículos cadastrados"
            }
            color="cyan"
            to="/frota"
            icon={<Icon name="truck" />}
          />
          <StatCard
            title="Custo acumulado"
            value={overviewValue(() => formatCurrency(overview?.totalGastos ?? 0))}
            loading={overviewLoading}
            hint={
              overview && !overviewError
                ? `Média ${formatCurrency(overview.mediaPorLancamento ?? overview.mediaGastos ?? 0)} por lançamento`
                : "Gastos + manutenções"
            }
            color="green"
            to={canReadReports ? "/relatorios" : "/manutencao-gastos"}
            icon={<Icon name="money" />}
          />
          <StatCard
            title="Manutenções"
            value={overviewValue(() => formatNumber(overview?.totalManutencoes ?? 0))}
            loading={overviewLoading}
            hint="Serviços registrados"
            color="orange"
            to="/manutencao-gastos?tipo=manutencao"
            icon={<Icon name="wrench" />}
          />
          {canReadAlerts ? (
            <StatCard
              title="Pendências"
              value={alertsQuery.error ? "Indisponível" : formatNumber(counts?.total ?? 0)}
              loading={alertsQuery.isLoading}
              hint={
                urgent > 0
                  ? `${urgent} exigem ação imediata`
                  : (counts?.total ?? 0) > 0
                    ? "Vencimentos nos próximos 30 dias"
                    : "Nada vencendo em 30 dias"
              }
              emphasis={urgent > 0}
              color={urgent > 0 ? "red" : "slate"}
              to="#pendencias"
              icon={<Icon name="bell" />}
            />
          ) : (
            <StatCard
              title="Lançamentos"
              value={overviewValue(() => formatNumber((overview?.gastosCount ?? 0) + (overview?.totalManutencoes ?? 0)))}
              loading={overviewLoading}
              hint="Gastos e manutenções"
              color="slate"
              to="/manutencao-gastos"
              icon={<Icon name="receipt" />}
            />
          )}
        </div>
      </section>

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
            overview={overview}
            trendMonths={trendQuery.data?.months}
            trendLoading={trendQuery.isLoading}
            truckCosts={costQuery.data?.items}
            truckCostsLoading={costQuery.isFetching}
          />
        </Suspense>
      ) : null}

      <section id="frota" className="scroll-mt-24" aria-labelledby="frota-title">
        <Card
          noPadding
          className="overflow-hidden"
          title={<span id="frota-title">Frota</span>}
          subtitle={
            pagination?.totalItems > FLEET_PREVIEW
              ? `Mostrando ${caminhoes.length} de ${pagination.totalItems} veículos`
              : "Veículos cadastrados"
          }
          action={
            <Link
              to="/frota"
              className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-secondary-dark hover:text-secondary"
            >
              Ver todos os veículos <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {fleetQuery.error ? (
            <div className="p-4">
              <Alert
                type="error"
                title="Erro ao carregar frota"
                message={fleetQuery.error.message || "Não foi possível carregar a frota."}
              >
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => fleetQuery.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              </Alert>
            </div>
          ) : fleetQuery.isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={4} columns={5} />
            </div>
          ) : caminhoes.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Icon name="truck" className="h-5 w-5" />}
                title="Você ainda não possui veículos cadastrados."
                description="Cadastre o primeiro caminhão para acompanhar gastos, manutenção e documentos."
                action={
                  canWriteFrota ? (
                    <Link to={vehicleQuotaReached ? "/assinatura" : "/cadastro-caminhao"}>
                      <Button>{vehicleQuotaReached ? "Fazer upgrade" : "Adicionar veículo"}</Button>
                    </Link>
                  ) : null
                }
                dashed
              />
            </div>
          ) : (
            <FleetTable caminhoes={caminhoes} canWrite={canWriteFrota} onDelete={del.requestDelete} />
          )}
        </Card>
      </section>

      <ConfirmModal
        isOpen={Boolean(del.target)}
        onClose={del.cancel}
        onConfirm={del.confirm}
        title="Excluir caminhão"
        message={del.confirmMessage}
        confirmText={del.deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        warning
        loading={del.deleting}
      />
    </PageLayout>
  );
};

export default Home;
