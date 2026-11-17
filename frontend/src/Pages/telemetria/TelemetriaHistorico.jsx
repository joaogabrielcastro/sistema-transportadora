import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import { Alert, Button, StatCard } from "../../components/ui";
import FleetMap from "../../components/telemetria/FleetMap.jsx";
import { FLEET_MAP_STYLES } from "../../components/telemetria/mapStyles.js";
import {
  FleetStatusChart,
  FuelEfficiencyChart,
  KmByVehicleChart,
  SpeedTimelineChart,
} from "../../components/telemetria/TelemetryCharts.jsx";
import { useCaminhoesListQuery } from "../../hooks/queries/useCaminhoesQuery.js";
import {
  useTelemetryCurrentQuery,
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
  const [searchParams] = useSearchParams();
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

  const { data: current = [] } = useTelemetryCurrentQuery(
    {},
    { enabled: !vehicleMode, refetchInterval: 20_000 },
  );
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
      <Link
        to="/telemetria"
        className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-secondary hover:underline"
      >
        Ao vivo
      </Link>
    </form>
  );

  // ——— Visão geral (sem veículo) ———
  if (!vehicleMode) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <div className="sticky top-0 z-20 -mx-1 px-1 pb-2 pt-1">{filters}</div>

          <div>
            <h1 className="text-xl font-bold text-text-primary">Histórico</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Visão geral da frota. Selecione um veículo para ver o trajeto e os
              gráficos dele.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Rendimento médio"
              value={
                loadingEff
                  ? "…"
                  : efficiency?.fleet_km_per_l != null
                    ? `${Number(efficiency.fleet_km_per_l).toFixed(2)} km/L`
                    : "—"
              }
            />
            <StatCard
              title="Km no período"
              value={loadingEff ? "…" : totalKm.toFixed(0)}
            />
            <StatCard title="Veículos ao vivo" value={current.length} />
            <StatCard
              title="Placas com km"
              value={(efficiency?.vehicles || []).filter((v) => Number(v.km) > 0)
                .length}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FuelEfficiencyChart vehicles={efficiency?.vehicles || []} />
            <KmByVehicleChart vehicles={efficiency?.vehicles || []} />
            <div className="lg:col-span-2">
              <FleetStatusChart rows={current} />
            </div>
          </div>
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
          <div className="absolute left-3 right-3 top-[5.5rem] z-[600] sm:left-4 sm:right-auto sm:w-[380px]">
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

        <aside className="absolute bottom-3 left-3 top-[5.5rem] z-[500] flex w-[min(100%-1.5rem,320px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur sm:left-4">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Histórico do veículo
            </p>
            <p className="text-sm font-semibold text-text-primary">
              {data?.placa || "Carregando…"}
              {isLoading ? " · carregando…" : ""}
            </p>
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
              <div className="h-[200px]">
                <FuelEfficiencyChart vehicles={vehicleKm} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <dl className="grid grid-cols-2 gap-2 border-b border-border p-3 text-sm">
                <div className="rounded-lg bg-cyan-50 px-2.5 py-2 ring-1 ring-cyan-100">
                  <dt className="text-[11px] font-semibold text-cyan-800">
                    Rendimento
                  </dt>
                  <dd className="font-bold tabular-nums text-cyan-950">
                    {data?.period_km_per_l != null
                      ? `${Number(data.period_km_per_l).toFixed(2)} km/L`
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Combustível</dt>
                  <dd className="font-semibold tabular-nums">
                    {data?.period_fuel_l != null
                      ? `${Number(data.period_fuel_l).toFixed(1)} L`
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Distância</dt>
                  <dd className="font-semibold tabular-nums">
                    {(data?.period_km != null
                      ? Number(data.period_km)
                      : distanceKm
                    ).toFixed(1)}{" "}
                    km
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                  <dt className="text-[11px] text-text-secondary">Vel. média</dt>
                  <dd className="font-semibold tabular-nums">
                    {avgSpeed != null ? `${avgSpeed.toFixed(0)} km/h` : "—"}
                  </dd>
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
                  {cursor?.heading != null
                    ? ` · ${Math.round(cursor.heading)}°`
                    : ""}
                </p>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
                {points.map((p, i) => {
                  const active = i === playIndex;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(false);
                          setPlayIndex(i);
                        }}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm ${
                          active ? "bg-cyan-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-semibold text-text-primary">
                          {formatWhen(p.when)}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {p.speedKmh != null
                            ? `${Math.round(p.speedKmh)} km/h`
                            : "—"}
                          {p.ignition === true
                            ? " · ignição on"
                            : p.ignition === false
                              ? " · ignição off"
                              : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        <div className="absolute bottom-3 right-3 z-[500] hidden w-[min(100%-1.5rem,420px)] flex-col gap-2 sm:flex">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur">
            <div className="h-[200px] [&_.border]:border-0 [&_.shadow-sm]:shadow-none">
              <FuelEfficiencyChart
                vehicles={
                  data?.period_km_per_l != null
                    ? [
                        {
                          caminhao_id: data.caminhao_id,
                          placa: data.placa,
                          km_per_l: data.period_km_per_l,
                        },
                      ]
                    : vehicleKm
                }
              />
            </div>
          </div>
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
