import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import {
  Card,
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  PageHeader,
  StatCard,
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import { useTelemetryDrivingQuery } from "../../hooks/queries/useTelemetryQueries.js";
import {
  BEHAVIOR_EVENT_TYPES,
  DRIVING_EVENTS,
  SECURITY_EVENT_TYPES,
  drivingEventLabel,
  formatDrivingValue,
  formatKm,
  googleMapsUrl,
} from "../../utils/telemetryDisplay.js";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function periodParams(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  // Arredonda para o minuto: evita refazer a consulta a cada render.
  from.setSeconds(0, 0);
  to.setSeconds(59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatWhen(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const fmtInt = (n) => Number(n || 0).toLocaleString("pt-BR");

function CountCell({ value }) {
  const n = Number(value || 0);
  return (
    <DataTableTd align="right" className="tabular-nums">
      {n > 0 ? <span className="font-semibold text-text-primary">{fmtInt(n)}</span> : <span className="text-text-light">0</span>}
    </DataTableTd>
  );
}

export default function TelemetriaConducao() {
  const [days, setDays] = useState(30);
  const [typeFilter, setTypeFilter] = useState("");
  const params = useMemo(() => periodParams(days), [days]);
  const { data, isLoading, isError, error } = useTelemetryDrivingQuery({ ...params, limit: 300 });

  const totals = data?.totals || {};
  const vehicles = data?.vehicles || [];
  const drivers = (data?.drivers || []).filter((d) => d.behavior_events > 0 || d.motorista_id);
  const events = (data?.events || []).filter((e) => !typeFilter || e.tipo === typeFilter);
  const securityTotal = SECURITY_EVENT_TYPES.reduce((a, t) => a + Number(totals[t] || 0), 0);
  const totalKm = vehicles.reduce((a, v) => a + Number(v.km || 0), 0);
  const fleetPer100 = totalKm >= 10 ? (Number(data?.behavior_total || 0) / totalKm) * 100 : null;

  const periodPicker = (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Período">
      {PERIODS.map((p) => (
        <button
          key={p.days}
          type="button"
          onClick={() => setDays(p.days)}
          aria-pressed={days === p.days}
          className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors ${
            days === p.days ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Telemetria"
          title="Condução"
          subtitle="Frenagens, acelerações e curvas bruscas e excessos de velocidade registrados pelo rastreador. Use para conversar com o motorista e reduzir desgaste, consumo e risco."
          actions={periodPicker}
        />

        {isError ? (
          <Card>
            <EmptyState
              compact
              icon={<Icon name="alert" className="h-5 w-5" />}
              title="Não foi possível carregar os eventos"
              description={error?.message || "Tente novamente em instantes."}
            />
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            layout="compact"
            title="Eventos de condução"
            value={isLoading ? "…" : fmtInt(data?.behavior_total)}
            hint={`Últimos ${days} dias`}
            color="orange"
            icon={<Icon name="gauge" />}
          />
          <StatCard
            layout="compact"
            title="Por 100 km (frota)"
            value={isLoading ? "…" : fleetPer100 == null ? "—" : fleetPer100.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            hint={totalKm > 0 ? `${formatKm(totalKm)} rodados` : "Sem km no período"}
            color="cyan"
            icon={<Icon name="route" />}
          />
          <StatCard
            layout="compact"
            title="Excessos de velocidade"
            value={isLoading ? "…" : fmtInt(totals.overspeed)}
            color="red"
            icon={<Icon name="alert" />}
          />
          <StatCard
            layout="compact"
            title="Segurança do rastreador"
            value={isLoading ? "…" : fmtInt(securityTotal)}
            hint="Desconexão, reboque, colisão, jammer"
            color={securityTotal > 0 ? "amber" : "slate"}
            emphasis={securityTotal > 0}
            icon={<Icon name="shield" />}
          />
        </div>

        <Card noPadding className="overflow-hidden" title="Por veículo" subtitle="Ordenado pelo total de eventos de condução. A taxa por 100 km permite comparar veículos que rodaram distâncias diferentes.">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={4} columns={7} />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={<Icon name="signal" className="h-5 w-5" />}
                title="Nenhum evento no período"
                description="Os eventos aparecem quando o rastreador está configurado para enviar condução (green driving) e excesso de velocidade."
                action={
                  <Link to="/telemetria/dispositivos" className="text-sm font-semibold text-secondary-dark hover:underline">
                    Ver dispositivos
                  </Link>
                }
              />
            </div>
          ) : (
            <DataTable fixed={false}>
              <DataTableHead>
                <tr>
                  <DataTableTh>Veículo</DataTableTh>
                  <DataTableTh align="right">Km</DataTableTh>
                  {BEHAVIOR_EVENT_TYPES.map((t) => (
                    <DataTableTh key={t} align="right">{DRIVING_EVENTS[t].short}</DataTableTh>
                  ))}
                  <DataTableTh align="right">Por 100 km</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {vehicles.map((v) => (
                  <DataTableRow key={v.caminhao_id}>
                    <DataTableTd>
                      <span className="plate">{v.placa || `#${v.caminhao_id}`}</span>
                    </DataTableTd>
                    <DataTableTd align="right" className="whitespace-nowrap tabular-nums">
                      {Number(v.km) > 0 ? formatKm(v.km) : <span className="text-text-light">—</span>}
                    </DataTableTd>
                    {BEHAVIOR_EVENT_TYPES.map((t) => (
                      <CountCell key={t} value={v.counts?.[t]} />
                    ))}
                    <DataTableTd align="right" className="tabular-nums">
                      {v.per_100km == null ? (
                        <span className="text-text-light" title="Menos de 10 km rodados no período">—</span>
                      ) : (
                        <span className="font-semibold text-text-primary">
                          {Number(v.per_100km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </span>
                      )}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
          <Card noPadding className="overflow-hidden" title="Por motorista" subtitle="Identificado pelo iButton (quando o rastreador lê) ou pelo motorista vinculado ao veículo.">
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={3} columns={3} />
              </div>
            ) : drivers.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">Nenhum evento associado a motorista no período.</p>
            ) : (
              <DataTable fixed={false}>
                <DataTableHead>
                  <tr>
                    <DataTableTh>Motorista</DataTableTh>
                    <DataTableTh align="right">Frenagens</DataTableTh>
                    <DataTableTh align="right">Excessos</DataTableTh>
                    <DataTableTh align="right">Total</DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {drivers.map((d) => (
                    <DataTableRow key={d.motorista_id ?? "sem"}>
                      <DataTableTd>
                        {d.nome || <span className="text-text-light">Sem motorista identificado</span>}
                      </DataTableTd>
                      <CountCell value={d.counts?.harsh_braking} />
                      <CountCell value={d.counts?.overspeed} />
                      <CountCell value={d.behavior_events} />
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </Card>

          <Card
            noPadding
            className="overflow-hidden"
            title="Últimos eventos"
            subtitle="Clique no local para abrir no mapa."
            action={
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filtrar por tipo"
                className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-medium text-text-primary"
              >
                <option value="">Todos os tipos</option>
                {Object.keys(DRIVING_EVENTS).map((t) => (
                  <option key={t} value={t}>{DRIVING_EVENTS[t].label}</option>
                ))}
              </select>
            }
          >
            {isLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} columns={4} />
              </div>
            ) : events.length === 0 ? (
              <p className="p-4 text-sm text-text-secondary">Nenhum evento para mostrar.</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
                {events.slice(0, 100).map((e) => {
                  const intensity = formatDrivingValue(e.tipo, e.valor);
                  const mapUrl = googleMapsUrl(e.latitude, e.longitude);
                  const security = SECURITY_EVENT_TYPES.includes(e.tipo);
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          security ? "bg-red-500" : e.tipo === "overspeed" ? "bg-orange-500" : "bg-amber-400"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {drivingEventLabel(e.tipo)}
                          {intensity ? <span className="ml-1.5 font-normal text-text-secondary">{intensity}</span> : null}
                        </p>
                        <p className="text-xs text-text-secondary">
                          <span className="plate mr-1.5">{e.placa || "—"}</span>
                          {e.motorista || "Motorista não identificado"}
                          {e.velocidade_kmh != null && e.tipo !== "overspeed" ? ` · ${Math.round(e.velocidade_kmh)} km/h` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-text-secondary">
                        <p className="tabular-nums">{formatWhen(e.ocorrido_em)}</p>
                        {mapUrl ? (
                          <a href={mapUrl} target="_blank" rel="noreferrer" className="font-semibold text-secondary-dark hover:underline">
                            Ver local
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <p className="text-xs leading-5 text-text-light">
          Frenagem, aceleração e curva são medidas pelo acelerômetro do rastreador (em g); os limites são definidos na configuração do aparelho. O excesso de velocidade usa o limite configurado no rastreador.
        </p>
      </div>
    </PageLayout>
  );
}
