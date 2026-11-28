import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../components/layout/PageLayout.jsx";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  PageHeader,
  StatCard,
  Tabs,
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Pagination from "../../components/Pagination.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import ViagemStatusBadge from "../../components/viagens/ViagemStatusBadge.jsx";
import { NovaViagemModal } from "../../components/viagens/ViagemModals.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";
import {
  useViagensListQuery,
  useViagensRelatorioQuery,
  useViagensResumoQuery,
} from "../../hooks/queries/useViagensQueries.js";
import {
  HISTORICO_LABEL,
  STATUS_OPTIONS,
  fmtCustoKm,
  fmtDataHora,
  fmtKm,
  fmtMoney,
  formatDuracao,
  minutosDesde,
  periodoDias,
} from "../../utils/viagens.js";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function PeriodPicker({ days, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-white p-0.5" role="group" aria-label="Período">
      {PERIODS.map((p) => (
        <button
          key={p.days}
          type="button"
          onClick={() => onChange(p.days)}
          aria-pressed={days === p.days}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            days === p.days ? "bg-primary text-white" : "text-text-secondary hover:bg-slate-50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function Rota({ origem, destino }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">{origem}</span>
      <Icon name="route" className="h-3.5 w-3.5 shrink-0 text-text-light" />
      <span className="truncate font-medium">{destino}</span>
    </span>
  );
}

// ——— Painel ———

function Painel({ days, setDays, fin }) {
  const params = useMemo(() => periodoDias(days), [days]);
  const { data, isLoading, isError } = useViagensResumoQuery(params);
  const now = Date.now();
  if (isError) return <Alert type="error" message="Não foi possível carregar o painel de viagens." />;
  const d = data || {};
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Indicadores das viagens encerradas no período.</p>
        <PeriodPicker days={days} onChange={setDays} />
      </div>
      <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${fin ? "2xl:grid-cols-6" : "xl:grid-cols-4"}`}>
        <StatCard title="Em andamento" value={d.em_andamento ?? 0} icon={<Icon name="route" />} color="blue" loading={isLoading} hint={d.planejadas ? `${d.planejadas} planejada(s)` : "agora"} />
        <StatCard title="Finalizadas" value={d.finalizadas ?? 0} icon={<Icon name="check" />} color="green" loading={isLoading} hint={`últimos ${days} dias`} />
        <StatCard title="Km percorrido" value={fmtKm(d.km_percorrido ?? 0)} icon={<Icon name="gauge" />} color="cyan" loading={isLoading} hint="viagens finalizadas" />
        <StatCard
          title="Com ocorrências"
          value={d.com_ocorrencias ?? 0}
          icon={<Icon name="alert" />}
          color={d.com_ocorrencias ? "amber" : "slate"}
          loading={isLoading}
          hint={d.canceladas ? `${d.canceladas} cancelada(s)` : "das finalizadas"}
        />
        {fin ? (
          <>
            <StatCard title="Despesas registradas" value={fmtMoney(d.total_despesas)} icon={<Icon name="money" />} color="purple" loading={isLoading} hint="lançadas no período" />
            <StatCard title="Custo por km" value={fmtCustoKm(d.custo_por_km)} icon={<Icon name="chart" />} color="orange" loading={isLoading} hint="despesas ÷ km das finalizadas" />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Caminhões em viagem" subtitle="Viagens em andamento agora" noPadding>
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={3} columns={4} /></div>
          ) : !d.caminhoes_em_viagem?.length ? (
            <div className="p-4">
              <EmptyState compact dashed icon={<Icon name="truck" className="h-5 w-5" />} title="Nenhum caminhão em viagem" description="Quando uma viagem for iniciada, ela aparece aqui até ser encerrada." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {d.caminhoes_em_viagem.map((v) => (
                <li key={v.id}>
                  <Link to={`/viagens/${v.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3 sm:w-48">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-white">{v.caminhao?.placa}</span>
                      <span className="truncate text-sm text-text-secondary">{v.motorista?.nome || "—"}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-sm text-text-primary"><Rota origem={v.origem} destino={v.destino} /></div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary sm:justify-end">
                      <span title={`Saída ${fmtDataHora(v.saida_em)}`}>há {formatDuracao(minutosDesde(v.saida_em, now))}</span>
                      {fin ? <span className="tabular-nums font-medium text-text-primary">{fmtMoney(v.total_despesas)}</span> : null}
                      <span className="text-text-light">nº {v.numero}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Últimas operações" subtitle="Quem fez o quê nas viagens" noPadding>
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} columns={2} /></div>
          ) : !d.ultimas_operacoes?.length ? (
            <div className="p-4"><EmptyState compact dashed title="Sem operações ainda" description="Inícios, despesas e encerramentos aparecem aqui." /></div>
          ) : (
            <ol className="divide-y divide-border">
              {d.ultimas_operacoes.slice(0, 8).map((h) => (
                <li key={h.id} className="px-4 py-2.5 sm:px-5">
                  <Link to={`/viagens/${h.viagem_id}`} className="block hover:underline">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{HISTORICO_LABEL[h.acao] || h.acao}</span>
                      <span className="text-text-secondary"> · nº {h.viagem_numero} {h.placa ? `· ${h.placa}` : ""}</span>
                    </p>
                  </Link>
                  <p className="text-xs text-text-secondary">
                    {h.usuario?.nome || "Sistema"} · {fmtDataHora(h.criado_em)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

// ——— Lista ———

const EMPTY_FILTERS = { status: "", caminhao_id: "", motorista_id: "", de: "", ate: "", origem: "", destino: "", q: "", com_ocorrencias: false };

function Lista({ fin, canSeeDespesas }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const set = (k) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  };
  const caminhoes = useQuery({
    queryKey: queryKeys.caminhoes.list({ page: 1, limit: 200, uso: "viagem" }),
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: "/caminhoes", params: { page: 1, limit: 200 } })),
  });
  const motoristas = useQuery({
    queryKey: queryKeys.motoristas.list({}),
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: "/motoristas" })),
  });
  const params = {
    ...filters,
    de: filters.de ? new Date(`${filters.de}T00:00:00`).toISOString() : "",
    ate: filters.ate ? new Date(`${filters.ate}T23:59:59`).toISOString() : "",
    com_ocorrencias: filters.com_ocorrencias ? 1 : "",
    page,
    limit: 20,
  };
  const { data, isLoading, isError, isFetching } = useViagensListQuery(params);
  const items = data?.items || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const activeFilters = Object.entries(filters).some(([k, v]) => v && EMPTY_FILTERS[k] !== v);

  const control = "control h-10 w-full";
  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="xl:col-span-2">
          <span className="mb-1 block text-xs font-medium text-text-secondary">Buscar</span>
          <input className={control} value={filters.q} onChange={set("q")} placeholder="Nº, placa, motorista, cidade" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Situação</span>
          <select className={control} value={filters.status} onChange={set("status")}>
            <option value="">Todas</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Caminhão</span>
          <select className={control} value={filters.caminhao_id} onChange={set("caminhao_id")}>
            <option value="">Todos</option>
            {(caminhoes.data || []).filter((c) => c.tipo_veiculo !== "carreta").map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Motorista</span>
          <select className={control} value={filters.motorista_id} onChange={set("motorista_id")}>
            <option value="">Todos</option>
            {(motoristas.data || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Saída de</span>
          <input type="date" className={control} value={filters.de} onChange={set("de")} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">até</span>
          <input type="date" className={control} value={filters.ate} onChange={set("ate")} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Origem</span>
          <input className={control} value={filters.origem} onChange={set("origem")} placeholder="Cidade" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-text-secondary">Destino</span>
          <input className={control} value={filters.destino} onChange={set("destino")} placeholder="Cidade" />
        </label>
        <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-6">
          <label className="flex h-10 items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" className="rounded border-border" checked={filters.com_ocorrencias} onChange={set("com_ocorrencias")} />
            Só com ocorrências
          </label>
          {activeFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
              Limpar filtros
            </Button>
          ) : null}
          {isFetching && !isLoading ? <span className="text-xs text-text-light">Atualizando…</span> : null}
        </div>
      </div>

      {isError ? (
        <Alert type="error" message="Não foi possível carregar as viagens." />
      ) : isLoading ? (
        <div className="card p-4"><TableSkeleton rows={6} columns={7} /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon name="route" className="h-5 w-5" />}
          title={activeFilters ? "Nenhuma viagem com esses filtros" : "Nenhuma viagem registrada"}
          description={activeFilters ? "Ajuste ou limpe os filtros." : "Inicie a primeira viagem pelo botão Nova viagem."}
        />
      ) : (
        <div className="card overflow-hidden">
          <DataTable fixed={false}>
            <DataTableHead>
              <tr>
                <DataTableTh>Nº</DataTableTh>
                <DataTableTh>Caminhão</DataTableTh>
                <DataTableTh>Motorista</DataTableTh>
                <DataTableTh>Rota</DataTableTh>
                <DataTableTh>Saída / chegada</DataTableTh>
                <DataTableTh align="right">Km</DataTableTh>
                {canSeeDespesas && !fin ? <DataTableTh align="right">Despesas</DataTableTh> : null}
                {fin ? <DataTableTh align="right">Despesas</DataTableTh> : null}
                {fin ? <DataTableTh align="right">Custo/km</DataTableTh> : null}
                <DataTableTh>Situação</DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((v) => (
                <DataTableRow key={v.id} onClick={() => navigate(`/viagens/${v.id}`)}>
                  <DataTableTd className="tabular-nums text-text-secondary">
                    <Link to={`/viagens/${v.id}`} className="font-semibold text-text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {v.numero}
                    </Link>
                  </DataTableTd>
                  <DataTableTd className="font-mono font-semibold">{v.caminhao?.placa}</DataTableTd>
                  <DataTableTd className="whitespace-nowrap">{v.motorista?.nome || "—"}</DataTableTd>
                  <DataTableTd className="min-w-[14rem] max-w-[18rem]">
                    <Rota origem={v.origem} destino={v.destino} />
                    {v.tem_ocorrencia ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Icon name="alert" className="h-3.5 w-3.5" /> Ocorrência
                      </span>
                    ) : null}
                  </DataTableTd>
                  <DataTableTd className="whitespace-nowrap tabular-nums">
                    {fmtDataHora(v.saida_em)}
                    <span className="block text-xs text-text-secondary">
                      {v.chegada_em ? fmtDataHora(v.chegada_em) : v.status === "em_andamento" ? `há ${formatDuracao(minutosDesde(v.saida_em))}` : "—"}
                    </span>
                  </DataTableTd>
                  <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{v.km_percorrido != null ? fmtKm(v.km_percorrido) : "—"}</DataTableTd>
                  {canSeeDespesas && !fin ? <DataTableTd align="right" className="tabular-nums">{v.qtd_despesas ?? "—"}</DataTableTd> : null}
                  {fin ? <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{fmtMoney(v.total_despesas)}</DataTableTd> : null}
                  {fin ? <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{fmtCustoKm(v.custo_por_km)}</DataTableTd> : null}
                  <DataTableTd><ViagemStatusBadge status={v.status} /></DataTableTd>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-text-secondary">
            <span>{data.total} viagem(ns)</span>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Relatório ———

function TabelaGrupo({ title, rows, fin, nomeLabel }) {
  return (
    <Card title={title} noPadding>
      {!rows?.length ? (
        <div className="p-4"><EmptyState compact dashed title="Sem viagens finalizadas no período" /></div>
      ) : (
        <DataTable fixed={false}>
          <DataTableHead>
            <tr>
              <DataTableTh>{nomeLabel}</DataTableTh>
              <DataTableTh align="right">Viagens</DataTableTh>
              <DataTableTh align="right">Km</DataTableTh>
              <DataTableTh align="right">Horas</DataTableTh>
              <DataTableTh align="right">Ocorrências</DataTableTh>
              {fin ? <DataTableTh align="right">Despesas</DataTableTh> : null}
              {fin ? <DataTableTh align="right">Custo/km</DataTableTh> : null}
            </tr>
          </DataTableHead>
          <DataTableBody>
            {rows.map((r) => (
              <DataTableRow key={String(r.id)}>
                <DataTableTd className="font-medium">{r.nome}</DataTableTd>
                <DataTableTd align="right" className="tabular-nums">{r.viagens}</DataTableTd>
                <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{fmtKm(r.km)}</DataTableTd>
                <DataTableTd align="right" className="tabular-nums">{Number(r.horas).toLocaleString("pt-BR")}</DataTableTd>
                <DataTableTd align="right" className={`tabular-nums ${r.ocorrencias ? "font-semibold text-amber-700" : "text-text-light"}`}>{r.ocorrencias}</DataTableTd>
                {fin ? <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{fmtMoney(r.total_despesas)}</DataTableTd> : null}
                {fin ? <DataTableTd align="right" className="whitespace-nowrap tabular-nums">{fmtCustoKm(r.custo_por_km)}</DataTableTd> : null}
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </Card>
  );
}

function Relatorio({ days, setDays, fin }) {
  const params = useMemo(() => periodoDias(days), [days]);
  const { data, isLoading, isError } = useViagensRelatorioQuery(params);
  if (isError) return <Alert type="error" message="Não foi possível carregar o relatório." />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Viagens finalizadas no período, por caminhão e por motorista.</p>
        <PeriodPicker days={days} onChange={setDays} />
      </div>
      {isLoading ? (
        <div className="card p-4"><TableSkeleton rows={5} columns={6} /></div>
      ) : (
        <>
          <TabelaGrupo title="Por caminhão" nomeLabel="Placa" rows={data?.por_caminhao} fin={fin} />
          <TabelaGrupo title="Por motorista" nomeLabel="Motorista" rows={data?.por_motorista} fin={fin} />
          {fin && data?.por_categoria?.length ? (
            <Card title="Despesas por categoria" subtitle="Das viagens finalizadas no período">
              <ul className="space-y-2.5">
                {(() => {
                  const max = Math.max(...data.por_categoria.map((c) => c.total), 1);
                  return data.por_categoria.map((c) => (
                    <li key={c.categoria}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-text-primary">{c.categoria} <span className="text-xs font-normal text-text-secondary">· {c.quantidade} lançamento(s)</span></span>
                        <span className="tabular-nums">{fmtMoney(c.total)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-secondary" style={{ width: `${(c.total / max) * 100}%` }} />
                      </div>
                    </li>
                  ));
                })()}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

// ——— Página ———

export default function Viagens() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const fin = userHasPermission(user, PERMISSIONS.VIAGENS_FINANCEIRO);
  const canSeeDespesas = userHasPermission(user, PERMISSIONS.VIAGENS_DESPESAS_READ);
  const canCreate = userHasPermission(user, PERMISSIONS.VIAGENS_CREATE);
  const canStart = userHasPermission(user, PERMISSIONS.VIAGENS_START);
  const canReports = userHasPermission(user, PERMISSIONS.VIAGENS_REPORTS);
  const tabs = [
    { id: "painel", label: "Painel" },
    { id: "lista", label: "Viagens" },
    ...(canReports ? [{ id: "relatorio", label: "Relatório" }] : []),
  ];
  const aba = tabs.some((t) => t.id === searchParams.get("aba")) ? searchParams.get("aba") : "painel";
  const novaOpen = canCreate && searchParams.get("nova") === "1";
  const setParam = (k, v) =>
    setSearchParams((cur) => {
      const next = new URLSearchParams(cur);
      if (v == null) next.delete(k);
      else next.set(k, v);
      return next;
    }, { replace: true });

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Viagens"
        subtitle="Saída, despesas no caminho e chegada de cada caminhão."
        actions={
          canCreate ? (
            <Button type="button" onClick={() => setParam("nova", "1")}>
              <Icon name="plus" className="h-4 w-4" /> Nova viagem
            </Button>
          ) : null
        }
      />
      <Tabs tabs={tabs} activeTab={aba} onChange={(id) => setParam("aba", id === "painel" ? null : id)}>
        {aba === "painel" ? <Painel days={days} setDays={setDays} fin={fin} /> : null}
        {aba === "lista" ? <Lista fin={fin} canSeeDespesas={canSeeDespesas} /> : null}
        {aba === "relatorio" ? <Relatorio days={days} setDays={setDays} fin={fin} /> : null}
      </Tabs>
      <NovaViagemModal
        isOpen={novaOpen}
        canStart={canStart}
        onClose={() => setParam("nova", null)}
        onCreated={(v) => navigate(`/viagens/${v.id}`)}
      />
    </PageLayout>
  );
}
