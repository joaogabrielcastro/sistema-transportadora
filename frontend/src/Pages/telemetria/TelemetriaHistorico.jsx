import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import {
  formatDuration,
  formatKm,
  formatLiters,
  formatLitersPerKm,
  litersPerKm,
  segmentTrips,
} from "../../utils/telemetryDisplay.js";
import FleetMap from "../../components/telemetria/FleetMap.jsx";
import { FLEET_MAP_STYLES } from "../../components/telemetria/mapStyles.js";
import {
  KmByVehicleChart,
  SpeedTimelineChart,
} from "../../components/telemetria/TelemetryCharts.jsx";
import { useCaminhoesListQuery } from "../../hooks/queries/useCaminhoesQuery.js";
import {
  useTelemetryEfficiencyQuery,
  useTelemetryGeofencesQuery,
  useTelemetryHistoryQuery,
} from "../../hooks/queries/useTelemetryQueries.js";

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOffset(localValue) {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Histórico + gráficos:
 * - sem veículo: visão geral da frota no período
 * - com veículo: mapa/playback + gráficos daquele veículo
 */
export default function TelemetriaHistorico() {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [caminhaoId, setCaminhaoId] = useState(
    () => searchParams.get("caminhao") || "",
  );
  const [from, setFrom] = useState(toLocalInputValue(dayAgo));
  const [to, setTo] = useState(toLocalInputValue(now));
  const [submitted, setSubmitted] = useState(() => {
    const fromUrl = searchParams.get("caminhao");
    if (!fromUrl) {
      return {
        caminhaoId: null,
        from: toIsoOffset(toLocalInputValue(dayAgo)),
        to: toIsoOffset(toLocalInputValue(now)),
      };
    }
    return null;
  });
  const [mapStyle, setMapStyle] = useState("modern");
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);

  const { data: caminhoesRes } = useCaminhoesListQuery({ page: 1, limit: 200 });
  const trucks = caminhoesRes?.data || [];
  const { data: geofences = [] } = useTelemetryGeofencesQuery();

  const period = useMemo(
    () => ({
      from: submitted?.from || toIsoOffset(from),
      to: submitted?.to || toIsoOffset(to),
    }),
    [submitted, from, to],
  );

  const vehicleMode = Boolean(submitted?.caminhaoId);

  const { data: efficiency, isLoading: loadingEff } =
    useTelemetryEfficiencyQuery(period);

  useEffect(() => {
    const fromUrl = searchParams.get("caminhao");
    if (fromUrl) setCaminhaoId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get("caminhao");
    if (!fromUrl || (submitted && submitted.caminhaoId === fromUrl)) return;
    setSubmitted({
      caminhaoId: fromUrl,
      from: toIsoOffset(from),
      to: toIsoOffset(to),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const historyParams =
    vehicleMode && submitted
      ? {
          caminhao_id: Number(submitted.caminhaoId),
          from: submitted.from,
          to: submitted.to,
          limit: 2000,
        }
      : null;

  const { data, isLoading, error, refetch } = useTelemetryHistoryQuery(
    historyParams,
    { enabled: Boolean(historyParams) },
  );

  const points = useMemo(() => {
    const events = data?.events || [];
    return events
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e, i, arr) => {
        const lat = Number(e.latitude);
        const lng = Number(e.longitude);
        const next = arr[i + 1];
        const headingFromPath =
          next && next.latitude != null && next.longitude != null
            ? bearingDeg(
                [lat, lng],
                [Number(next.latitude), Number(next.longitude)],
              )
            : null;
        return {
          id: e.id,
          lat,
          lng,
          speedKmh:
            e.velocidade_kmh != null ? Number(e.velocidade_kmh) : null,
          heading: e.heading != null ? Number(e.heading) : headingFromPath,
          ignition: e.ignicao,
          when: e.registrado_em,
          odometerKm: e.odometro_km != null ? Number(e.odometro_km) : null,
        };
      });
  }, [data]);

  const path = useMemo(() => points.map((p) => [p.lat, p.lng]), [points]);

  const segments = useMemo(() => segmentTrips(points), [points]);
  const tripSummary = useMemo(() => {
    const trips = segments.filter((x) => x.type === "trip");
    const stops = segments.filter((x) => x.type === "stop");
    return {
      trips: trips.length,
      drivingMs: trips.reduce((a, b) => a + b.durationMs, 0),
      stoppedMs: stops.reduce((a, b) => a + b.durationMs, 0),
      idleMs: stops.filter((x) => x.ignitionOn).reduce((a, b) => a + b.durationMs, 0),
      maxSpeed: points.reduce((m, p) => (p.speedKmh != null && p.speedKmh > m ? p.speedKmh : m), 0),
    };
  }, [segments, points]);

  const distanceKm = useMemo(() => {
    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
      total += haversineKm(path[i - 1], path[i]);
    }
    return total;
  }, [path]);

  const avgSpeed = useMemo(() => {
    const speeds = points
      .map((p) => p.speedKmh)
      .filter((v) => v != null && Number.isFinite(v));
    if (!speeds.length) return null;
    return speeds.reduce((a, b) => a + b, 0) / speeds.length;
  }, [points]);

  const vehicleKm = useMemo(() => {
    const list = efficiency?.vehicles || [];
    if (!vehicleMode) return list;
    return list.filter(
      (v) => Number(v.caminhao_id) === Number(submitted.caminhaoId),
    );
  }, [efficiency, vehicleMode, submitted?.caminhaoId]);

  const totalKm = useMemo(
    () =>
      (efficiency?.vehicles || []).reduce(
        (sum, v) => sum + Number(v.km || 0),
        0,
      ),
    [efficiency],
  );

  useEffect(() => {
    setPlayIndex(0);
    setPlaying(false);
  }, [data?.caminhao_id, data?.count, submitted?.from, submitted?.to]);

  useEffect(() => {
    if (!playing || points.length < 2) return undefined;
    const timer = setInterval(() => {
      setPlayIndex((i) => {
        if (i >= points.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [playing, points.length]);

  const cursor =
    points[Math.min(playIndex, Math.max(0, points.length - 1))] || null;
  const trailUntil = useMemo(
    () => path.slice(0, Math.min(playIndex + 1, path.length)),
    [path, playIndex],
  );

  const markers = useMemo(() => {
    if (!cursor) return [];
    return [
      {
        id: data?.caminhao_id || "playback",
        lat: cursor.lat,
        lng: cursor.lng,
        label: data?.placa || "Veículo",
        speedKmh: cursor.speedKmh,
        heading: cursor.heading,
        moving: cursor.speedKmh != null && cursor.speedKmh > 3,
        status: "online",
        subtitle: [
          cursor.speedKmh != null
            ? `${Math.round(cursor.speedKmh)} km/h`
            : null,
          formatWhen(cursor.when),
        ]
          .filter(Boolean)
          .join(" · "),
      },
    ];
  }, [cursor, data?.caminhao_id, data?.placa]);

  const onSearch = (e) => {
    e.preventDefault();
    setSubmitted({
      caminhaoId: caminhaoId || null,
      from: toIsoOffset(from),
      to: toIsoOffset(to),
    });
  };

  const applyPreset = (hours) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600_000);
    if (hours === "hoje") start.setTime(new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime());
    const f = toLocalInputValue(start);
    const t = toLocalInputValue(end);
    setFrom(f);
    setTo(t);
    setSubmitted({ caminhaoId: caminhaoId || null, from: toIsoOffset(f), to: toIsoOffset(t) });
  };

  const presets = (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Períodos rápidos">
      {[
        { id: "hoje", label: "Hoje" },
        { id: 24, label: "24 h" },
        { id: 24 * 7, label: "7 dias" },
        { id: 24 * 30, label: "30 dias" },
      ].map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => applyPreset(p.id === "hoje" ? "hoje" : p.id)}
          className="inline-flex h-8 items-center rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-200"
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const filters = (
    <form
      onSubmit={onSearch}
      className="pointer-events-auto flex flex-wrap items-end gap-2 rounded-xl border border-border/80 bg-white/95 p-2 shadow-lg backdrop-blur"
    >
      <label className="flex min-w-[140px] flex-1 flex-col gap-0.5 text-xs">
        <span className="font-semibold text-text-secondary">Veículo</span>
        <select
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          value={caminhaoId}
          onChange={(e) => setCaminhaoId(e.target.value)}
        >
          <option value="">Toda a frota (geral)</option>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.placa}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-xs">
        <span className="font-semibold text-text-secondary">De</span>
        <input
          type="datetime-local"
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs">
        <span className="font-semibold text-text-secondary">Até</span>
        <input
          type="datetime-local"
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      {vehicleMode ? (
        <>
          <select
            className="h-9 rounded-lg border border-border bg-white px-2 text-xs font-semibold text-text-secondary"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value)}
            aria-label="Estilo do mapa"
          >
            {Object.entries(FLEET_MAP_STYLES).map(([key, style]) => (
              <option key={key} value={key}>
                {style.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowGeofences((v) => !v)}
            className={`h-9 rounded-lg px-2.5 text-xs font-semibold ${
              showGeofences
                ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200"
                : "bg-slate-100 text-text-secondary"
            }`}
          >
            Geocercas
          </button>
        </>
      ) : null}
      <Button type="submit" disabled={isLoading || loadingEff}>
        Consultar
      </Button>
      <div className="flex w-full items-center justify-between gap-2 border-t border-border pt-2">
        {presets}
        <Link
          to="/telemetria"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-secondary-dark hover:underline"
        >
          <Icon name="signal" className="h-3.5 w-3.5" /> Ao vivo
        </Link>
      </div>
    </form>
  );

  // ——— Visão geral (sem veículo) ———
  if (!vehicleMode) {
    const vehicles = efficiency?.vehicles || [];
    const rodaram = vehicles.filter((v) => Number(v.km) > 0);
    // Litros da mesma fonte que o backend usa no consumo: telemetria quando
    // houver; senão, os abastecimentos lançados.
    const litersOf = (v) =>
      v.efficiency_source === "telemetry"
        ? v.fuel_telemetry_l
        : v.efficiency_source === "manual"
          ? v.fuel_manual_l
          : null;
    const consumption = (v) => litersPerKm(litersOf(v), v.km);
    // Frota: soma dos litros ÷ soma dos km (média ponderada pela distância).
    const withFuel = vehicles.filter((v) => consumption(v).value != null);
    const fleetLKm = litersPerKm(
      withFuel.reduce((acc, v) => acc + Number(litersOf(v) || 0), 0),
      withFuel.reduce((acc, v) => acc + Number(v.km || 0), 0),
    );
    const implausibleCount = withFuel.filter((v) => !consumption(v).plausible).length;
    const sorted = [...vehicles].sort((a, b) => Number(b.km || 0) - Number(a.km || 0));

    return (
      <PageLayout>
        <div className="space-y-5">
          <PageHeader
            eyebrow="Telemetria"
            title="Histórico e desempenho"
            subtitle="Quilometragem e consumo por veículo no período. Escolha um veículo para ver o trajeto, as viagens e as paradas."
          />
          <div>{filters}</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              layout="compact"
              title="Km rodados no período"
              value={loadingEff ? "…" : formatKm(totalKm)}
              color="cyan"
              icon={<Icon name="route" />}
            />
            <StatCard
              layout="compact"
              title="Veículos que rodaram"
              value={loadingEff ? "…" : `${rodaram.length} de ${vehicles.length}`}
              hint="Com rastreador vinculado"
              color="slate"
              icon={<Icon name="truck" />}
            />
            <StatCard
              layout="compact"
              title="Consumo da frota"
              value={loadingEff ? "…" : formatLitersPerKm(fleetLKm.value)}
              hint={
                fleetLKm.value == null
                  ? "Sem litros registrados no período"
                  : !fleetLKm.plausible
                    ? "Fora da faixa esperada — verifique sensores"
                    : `${formatLiters(fleetLKm.liters)} em ${formatKm(fleetLKm.km)}`
              }
              color={fleetLKm.value != null && !fleetLKm.plausible ? "amber" : "green"}
              icon={<Icon name="fuel" />}
            />
          </div>

          {implausibleCount > 0 ? (
            <Alert
              type="warning"
              title="Consumo com valores fora do esperado"
              message={`${implausibleCount} veículo(s) com consumo fora da faixa típica de caminhões (0,12 a 1,25 L/km). Normalmente indica contador de combustível do rastreador mal configurado; compare com o diesel lançado antes de usar o número.`}
            />
          ) : null}

          <Card noPadding className="overflow-hidden" title="Desempenho por veículo" subtitle="Ordenado por quilometragem no período">
            {loadingEff ? (
              <div className="p-4">
                <TableSkeleton rows={4} columns={5} />
              </div>
            ) : sorted.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Icon name="signal" className="h-5 w-5" />}
                  title="Sem dados de telemetria no período"
                  description="Vincule rastreadores aos veículos ou amplie o período."
                  action={
                    <Link to="/telemetria/dispositivos">
                      <Button variant="outline">Ver dispositivos</Button>
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
                    <DataTableTh align="right">Litros</DataTableTh>
                    <DataTableTh align="right">Litros por km</DataTableTh>
                    <DataTableTh align="right">Custo / km</DataTableTh>
                    <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {sorted.map((v) => {
                    const k = consumption(v);
                    return (
                      <DataTableRow key={v.caminhao_id}>
                        <DataTableTd>
                          <span className="plate">{v.placa}</span>
                        </DataTableTd>
                        <DataTableTd align="right" className="tabular-nums">
                          {Number(v.km) > 0 ? formatKm(v.km) : <span className="text-text-light">Parado</span>}
                        </DataTableTd>
                        <DataTableTd align="right" className="whitespace-nowrap tabular-nums">
                          {litersOf(v) != null ? formatLiters(litersOf(v)) : <span className="text-text-light">—</span>}
                          <span className="block text-[11px] text-text-light">
                            {v.efficiency_source === "telemetry"
                              ? `telemetria${v.fuel_manual_l != null ? ` · lançados ${formatLiters(v.fuel_manual_l)}` : ""}`
                              : v.efficiency_source === "manual"
                                ? "abastecimentos lançados"
                                : ""}
                          </span>
                        </DataTableTd>
                        <DataTableTd align="right" className="whitespace-nowrap tabular-nums">
                          {k.value == null ? (
                            <span className="text-text-light">—</span>
                          ) : (
                            <span className={k.plausible ? "font-semibold text-text-primary" : "text-amber-700"} title={k.plausible ? undefined : "Fora da faixa esperada para caminhões"}>
                              {!k.plausible ? <Icon name="alert" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /> : null}
                              {formatLitersPerKm(k.value)}
                            </span>
                          )}
                        </DataTableTd>
                        <DataTableTd align="right" className="tabular-nums">
                          {v.cost_per_km != null ? Number(v.cost_per_km).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-text-light">—</span>}
                        </DataTableTd>
                        <DataTableTd align="right">
                          <button
                            type="button"
                            onClick={() => {
                              setCaminhaoId(String(v.caminhao_id));
                              setSubmitted({ caminhaoId: String(v.caminhao_id), from: period.from, to: period.to });
                            }}
                            className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-secondary-dark hover:text-secondary"
                          >
                            Ver trajeto <Icon name="chevronRight" className="h-3.5 w-3.5" />
                          </button>
                        </DataTableTd>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            )}
          </Card>

          {sorted.length > 1 ? <KmByVehicleChart vehicles={sorted} /> : null}
        </div>
      </PageLayout>
    );
  }

  // ——— Veículo específico ———
  return (
    <PageLayout flush className="flex flex-col">
      <div className="relative min-h-[calc(100dvh-3.5rem)] flex-1 lg:min-h-[calc(100dvh-4rem)]">
        {path.length >= 2 ? (
          <FleetMap
            markers={markers}
            path={playing || playIndex > 0 ? trailUntil : path}
            selectedId={markers[0]?.id}
            mapStyle={mapStyle}
            followSelected={playing}
            geofences={showGeofences ? geofences : []}
            height="100%"
            className="absolute inset-0 rounded-none border-0"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-100" />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-4">
          {filters}
        </div>

        {error && (
          <div className="absolute left-3 right-3 top-[9rem] z-[600] sm:left-4 sm:right-auto sm:w-[380px]">
            <Alert type="error">
              {error?.response?.data?.error || "Falha ao carregar histórico."}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          </div>
        )}

        <aside className="absolute bottom-3 left-3 top-[12rem] z-[500] sm:top-[8.75rem] xl:top-[8.5rem] flex w-[min(100%-1.5rem,320px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur sm:left-4">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Histórico do veículo
              </p>
              <p className="mt-0.5 text-sm font-semibold text-text-primary">
                {data?.placa ? <span className="plate">{data.placa}</span> : "Carregando…"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCaminhaoId("");
                setSubmitted({ caminhaoId: null, from: period.from, to: period.to });
                const next = new URLSearchParams(searchParams);
                next.delete("caminhao");
                setSearchParams(next, { replace: true });
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50"
            >
              <Icon name="chevronLeft" className="h-3.5 w-3.5" /> Frota
            </button>
          </div>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center px-4 text-sm text-text-secondary">
              Carregando pontos…
            </div>
          ) : path.length < 2 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
              <p className="text-center text-sm text-text-secondary">
                Sem GPS suficiente neste período. Gráficos disponíveis abaixo.
              </p>
              <div className="h-[200px]">
                <KmByVehicleChart vehicles={vehicleKm} />
              </div>

            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <dl className="grid grid-cols-2 gap-2 border-b border-border p-3 text-sm">
                {(() => {
                  const c = litersPerKm(data?.period_fuel_l, data?.period_km);
                  return (
                    <div className="rounded-lg bg-cyan-50 px-2.5 py-2 ring-1 ring-cyan-100">
                      <dt className="text-[11px] font-semibold text-cyan-800">Litros por km</dt>
                      <dd className="font-bold tabular-nums text-cyan-950">{formatLitersPerKm(c.value)}</dd>
                      {c.value != null && !c.plausible ? (
                        <p className="text-[10px] leading-tight text-amber-700">Fora da faixa esperada</p>
                      ) : null}
                    </div>
                  );
                })()}
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Litros</dt>
                  <dd className="font-semibold tabular-nums">
                    {data?.period_fuel_l != null && Number(data.period_fuel_l) > 0 ? formatLiters(data.period_fuel_l) : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Distância</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatKm(data?.period_km != null ? Number(data.period_km) : distanceKm, 1)}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Tempo dirigindo</dt>
                  <dd className="font-semibold tabular-nums">
                    {tripSummary.drivingMs ? formatDuration(tripSummary.drivingMs) : "—"}
                  </dd>
                  <p className="text-[11px] text-text-secondary">
                    Vel. máx. {tripSummary.maxSpeed ? `${Math.round(tripSummary.maxSpeed)} km/h` : "—"}
                  </p>
                </div>
              </dl>

              <div className="space-y-2 border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => {
                      if (playIndex >= points.length - 1) setPlayIndex(0);
                      setPlaying((v) => !v);
                    }}
                  >
                    {playing ? "Pausar" : "Reproduzir"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-text-secondary"
                    onClick={() => {
                      setPlaying(false);
                      setPlayIndex(0);
                    }}
                  >
                    Início
                  </button>
                  <span className="ml-auto text-[11px] tabular-nums text-text-secondary">
                    {playIndex + 1}/{points.length}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, points.length - 1)}
                  value={playIndex}
                  onChange={(e) => {
                    setPlaying(false);
                    setPlayIndex(Number(e.target.value));
                  }}
                  className="w-full"
                  aria-label="Posição no trajeto"
                />
                <p className="text-xs text-text-secondary">
                  {formatWhen(cursor?.when)}
                  {cursor?.speedKmh != null ? ` · ${Math.round(cursor.speedKmh)} km/h` : ""}
                </p>
              </div>

              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Viagens e paradas
                </p>
                <p className="text-[11px] text-text-secondary">
                  {tripSummary.trips} viagem(ns)
                  {tripSummary.idleMs ? ` · ${formatDuration(tripSummary.idleMs)} parado ligado` : ""}
                </p>
              </div>
              <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto divide-y divide-border">
                {segments.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-text-secondary">
                    Poucos pontos para identificar viagens.
                  </li>
                ) : (
                  [...segments].reverse().map((sg) => {
                    const active = playIndex >= sg.startIndex && playIndex <= sg.endIndex;
                    const isTrip = sg.type === "trip";
                    return (
                      <li key={`${sg.type}-${sg.startIndex}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setPlaying(false);
                            setPlayIndex(sg.startIndex);
                          }}
                          className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm ${
                            active ? "bg-cyan-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              isTrip
                                ? "bg-emerald-50 text-emerald-700"
                                : sg.ignitionOn
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                            aria-hidden
                          >
                            <Icon name={isTrip ? "route" : "clock"} className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="font-semibold text-text-primary">
                                {isTrip ? "Viagem" : sg.ignitionOn ? "Parado ligado" : "Parada"}
                              </span>
                              <span className="text-xs tabular-nums text-text-secondary">
                                {formatDuration(sg.durationMs)}
                              </span>
                            </span>
                            <span className="block text-xs text-text-secondary">
                              {formatWhen(sg.startAt).slice(0, 12)} → {formatWhen(sg.endAt).slice(7, 12)}
                              {isTrip && sg.km != null ? ` · ${formatKm(sg.km, 1)}` : ""}
                              {isTrip && sg.maxSpeedKmh != null ? ` · máx. ${Math.round(sg.maxSpeedKmh)} km/h` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </aside>

        <div className="absolute bottom-3 right-3 z-[500] hidden w-[min(100%-1.5rem,420px)] flex-col gap-2 sm:flex">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur">
            <div className="h-[200px] [&_.border]:border-0 [&_.shadow-sm]:shadow-none">
              <SpeedTimelineChart
                points={points}
                title={
                  data?.placa ? `Velocidade — ${data.placa}` : "Velocidade"
                }
                subtitle="Curva do período consultado"
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
