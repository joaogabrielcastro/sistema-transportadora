import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import { Alert, Button, StatusBadge } from "../../components/ui";
import FleetMap, {
  FLEET_MAP_STYLES,
} from "../../components/telemetria/FleetMap.jsx";
import {
  useTelemetryCurrentQuery,
  useTelemetryGeofencesQuery,
} from "../../hooks/queries/useTelemetryQueries.js";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "moving", label: "Em movimento" },
  { id: "stopped", label: "Parados" },
  { id: "offline", label: "Sem sinal" },
];

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

function statusLabel(status) {
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  if (status === "awaiting") return "Aguardando";
  return status || "—";
}

function stateLabel(row) {
  if (row.status === "offline" || row.status === "awaiting") {
    return statusLabel(row.status);
  }
  if (row.ignition === false) return "Ignição off";
  if (row.moving) return "Em movimento";
  return "Parado";
}

function toRow(row) {
  const moving = row.velocidade_kmh != null && Number(row.velocidade_kmh) > 3;
  const odometerKm =
    row.odometro_km != null ? Number(row.odometro_km) : null;
  const fuelConsumedL =
    row.fuel_consumed_l != null ? Number(row.fuel_consumed_l) : null;
  const fuelLevelPct =
    row.fuel_level_pct != null ? Number(row.fuel_level_pct) : null;
  return {
    id: row.caminhao_id,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    label: row.placa || `Veículo #${row.caminhao_id}`,
    status: row.connection_status,
    moving,
    ignition: row.ignicao,
    speedKmh: row.velocidade_kmh != null ? Number(row.velocidade_kmh) : null,
    heading: row.heading != null ? Number(row.heading) : null,
    odometerKm,
    fuelConsumedL,
    fuelLevelPct,
    when: formatWhen(row.registrado_em),
    rawWhen: row.registrado_em,
    subtitle: [
      row.velocidade_kmh != null
        ? `${Number(row.velocidade_kmh).toFixed(0)} km/h`
        : null,
      moving ? "Em movimento" : "Parado",
      statusLabel(row.connection_status),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function distApprox(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function formatIdle(ms) {
  if (!ms || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

async function reverseGeocode(lat, lng) {
  // Client-side friendly (sem API key). Suficiente para demo/piloto.
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    lat,
  )}&longitude=${encodeURIComponent(lng)}&localityLanguage=pt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  const parts = [
    data?.locality,
    data?.city,
    data?.principalSubdivision,
  ].filter(Boolean);
  return [...new Set(parts)].join(", ") || null;
}

/**
 * Console operacional estilo mercado (Cobli / Infleet / Gobrax):
 * mapa em tela cheia + lista e detalhe flutuantes.
 */
export default function TelemetriaMonitoramento() {
  const { data: current = [], isLoading, error, refetch, isFetching } =
    useTelemetryCurrentQuery({}, { refetchInterval: 4_000 });
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const [mapStyle, setMapStyle] = useState("modern");
  const [followSelected, setFollowSelected] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  /** Rastro ao vivo: só o que a placa já percorreu nesta sessão (não desenha o caminho à frente). */
  const [liveTrails, setLiveTrails] = useState({});
  const [sessionFuel, setSessionFuel] = useState({});
  const [idleSince, setIdleSince] = useState({});
  const [idleNow, setIdleNow] = useState(Date.now());
  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  const { data: geofences = [] } = useTelemetryGeofencesQuery();

  const rows = useMemo(() => current.map(toRow), [current]);

  useEffect(() => {
    if (selectedId != null || !rows.length) return;
    const firstWithGps = rows.find(
      (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng),
    );
    if (firstWithGps) setSelectedId(firstWithGps.id);
  }, [rows, selectedId]);

  useEffect(() => {
    const resets = [];
    setLiveTrails((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
        const point = [row.lat, row.lng];
        const list = next[row.id] || [];
        const last = list[list.length - 1];
        if (!last) {
          next[row.id] = [point];
          changed = true;
          continue;
        }
        const jump = distApprox(last, point);
        if (jump < 0.00002) continue;
        // Novo ciclo / teleporte: reinicia o rastro (evita desenhar a rota toda na frente).
        if (jump > 0.025) {
          next[row.id] = [point];
          resets.push(row);
          changed = true;
          continue;
        }
        next[row.id] = [...list.slice(-180), point];
        changed = true;
      }
      return changed ? next : prev;
    });

    setSessionFuel((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of resets) {
        next[row.id] = {
          startOdo: row.odometerKm,
          startFuelL: row.fuelConsumedL,
          fuelLevelPct: row.fuelLevelPct,
        };
        changed = true;
      }
      for (const row of rows) {
        const cur = next[row.id] || {
          startOdo: row.odometerKm,
          startFuelL: row.fuelConsumedL,
        };
        if (cur.startOdo == null && row.odometerKm != null) {
          cur.startOdo = row.odometerKm;
          changed = true;
        }
        if (cur.startFuelL == null && row.fuelConsumedL != null) {
          cur.startFuelL = row.fuelConsumedL;
          changed = true;
        }
        const km =
          cur.startOdo != null && row.odometerKm != null
            ? Math.max(0, row.odometerKm - cur.startOdo)
            : null;
        const liters =
          cur.startFuelL != null && row.fuelConsumedL != null
            ? Math.max(0, row.fuelConsumedL - cur.startFuelL)
            : null;
        const kmPerL =
          km != null && liters != null && liters > 0.05 ? km / liters : null;
        const updated = {
          ...cur,
          km,
          liters,
          kmPerL,
          fuelLevelPct: row.fuelLevelPct,
        };
        next[row.id] = updated;
        changed = true;
      }
      return changed ? next : prev;
    });

    setIdleSince((prev) => {
      const next = { ...prev };
      let changed = false;
      const now = Date.now();
      for (const row of rows) {
        const stopped = !row.moving;
        if (stopped) {
          if (!next[row.id]) {
            next[row.id] = now;
            changed = true;
          }
        } else if (next[row.id]) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  useEffect(() => {
    const t = setInterval(() => setIdleNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    const moving = rows.filter((r) => r.moving && r.status === "online").length;
    const stopped = rows.filter(
      (r) => !r.moving && (r.status === "online" || r.ignition === true),
    ).length;
    const offline = rows.filter(
      (r) => r.status === "offline" || r.status === "awaiting",
    ).length;
    return { all: rows.length, moving, stopped, offline };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "moving" && !(row.moving && row.status === "online")) return false;
      if (
        filter === "stopped" &&
        !(!row.moving && (row.status === "online" || row.ignition === true))
      ) {
        return false;
      }
      if (
        filter === "offline" &&
        !(row.status === "offline" || row.status === "awaiting")
      ) {
        return false;
      }
      if (q && !String(row.label).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const selected =
    rows.find((r) => String(r.id) === String(selectedId)) || null;

  useEffect(() => {
    if (
      !selected ||
      !Number.isFinite(selected.lat) ||
      !Number.isFinite(selected.lng)
    ) {
      setAddress("");
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const label = await reverseGeocode(selected.lat, selected.lng);
        if (!cancelled) setAddress(label || "");
      } catch {
        if (!cancelled) setAddress("");
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    selected?.id,
    selected?.lat != null ? selected.lat.toFixed(4) : null,
    selected?.lng != null ? selected.lng.toFixed(4) : null,
  ]);

  const mapMarkers = useMemo(() => {
    const base = filtered.filter(
      (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng),
    );
    if (
      selected &&
      Number.isFinite(selected.lat) &&
      Number.isFinite(selected.lng) &&
      !base.some((r) => String(r.id) === String(selected.id))
    ) {
      return [...base, selected];
    }
    return base;
  }, [filtered, selected]);

  const trailPath = useMemo(() => {
    if (!showTrail || !selected) return [];
    return liveTrails[selected.id] || [];
  }, [liveTrails, selected, showTrail]);

  const fuelInfo = selected ? sessionFuel[selected.id] : null;
  const idleMs =
    selected && idleSince[selected.id]
      ? idleNow - idleSince[selected.id]
      : null;

  return (
    <PageLayout flush className="flex flex-col">
      <div className="relative min-h-[calc(100dvh-3.5rem)] flex-1 lg:min-h-[calc(100dvh-4rem)]">
        {error && (
          <div className="absolute left-3 right-3 top-3 z-[1000] sm:left-4 sm:right-auto sm:w-[380px]">
            <Alert type="error">
              {error?.response?.data?.error || "Falha ao carregar posições."}
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          </div>
        )}

        <FleetMap
          markers={mapMarkers}
          path={trailPath}
          selectedId={selectedId}
          onSelect={setSelectedId}
          mapStyle={mapStyle}
          followSelected={followSelected && Boolean(selectedId)}
          geofences={geofences}
          height="100%"
          className="absolute inset-0 rounded-none border-0"
        />

        {/* Barra superior — filtros */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-white/95 p-2 shadow-lg backdrop-blur">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => {
                const n = counts[f.id] ?? 0;
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-text-secondary hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                    <span className="ml-1 tabular-nums opacity-80">{n}</span>
                  </button>
                );
              })}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar placa…"
              className="h-9 w-full min-w-[140px] rounded-lg border border-border bg-white px-3 text-sm sm:w-44"
            />
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
              onClick={() => setShowTrail((v) => !v)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                showTrail
                  ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200"
                  : "bg-slate-100 text-text-secondary"
              }`}
            >
              Rastro
            </button>
            <button
              type="button"
              onClick={() => setFollowSelected((v) => !v)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                followSelected
                  ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200"
                  : "bg-slate-100 text-text-secondary"
              }`}
            >
              Seguir
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
            >
              Atualizar
            </Button>
            <button
              type="button"
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 lg:hidden"
              onClick={() => setListOpen((v) => !v)}
            >
              {listOpen ? "Ocultar lista" : "Lista"}
            </button>
          </div>
        </div>

        {/* Lista da frota — flutuante */}
        {listOpen && (
          <aside className="absolute bottom-3 left-3 top-[4.75rem] z-[500] flex w-[min(100%-1.5rem,320px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur sm:left-4 sm:top-[5rem]">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Frota
                </p>
                <p className="text-sm font-semibold text-text-primary">
                  {filtered.length} veículo(s)
                  {isLoading ? " · carregando…" : " · ao vivo"}
                </p>
              </div>
              <Link
                to="/telemetria/historico"
                className="text-xs font-semibold text-secondary hover:underline"
              >
                Histórico
              </Link>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
              {!filtered.length ? (
                <li className="px-3 py-8 text-center text-sm text-text-secondary">
                  {isLoading
                    ? "Carregando frota…"
                    : "Nenhum veículo neste filtro. Cadastre um dispositivo e aguarde o GPS."}
                </li>
              ) : (
                filtered.map((row) => {
                  const active = String(row.id) === String(selectedId);
                  const onMap = Number.isFinite(row.lat) && Number.isFinite(row.lng);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors ${
                          active ? "bg-cyan-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-text-primary">
                            {row.label}
                          </span>
                          <StatusBadge status={statusLabel(row.status)} />
                        </div>
                        <span className="text-xs text-text-secondary">
                          {stateLabel(row)}
                          {row.speedKmh != null
                            ? ` · ${row.speedKmh.toFixed(0)} km/h`
                            : ""}
                          {!onMap ? " · sem GPS" : ""}
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          {row.when}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>
        )}

        {/* Painel de detalhe do veículo */}
        {selected && (
          <div className="absolute bottom-3 right-3 z-[500] w-[min(100%-1.5rem,340px)] rounded-xl border border-border/80 bg-white/95 p-4 shadow-xl backdrop-blur sm:right-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Veículo selecionado
                </p>
                <h2 className="text-lg font-bold text-text-primary">{selected.label}</h2>
              </div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-slate-100"
                onClick={() => setSelectedId(null)}
                aria-label="Fechar detalhe"
              >
                Fechar
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Estado</dt>
                <dd className="font-semibold">{stateLabel(selected)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Velocidade</dt>
                <dd className="font-semibold tabular-nums">
                  {selected.speedKmh != null
                    ? `${selected.speedKmh.toFixed(0)} km/h`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-cyan-50 px-2.5 py-2 ring-1 ring-cyan-100">
                <dt className="text-[11px] font-semibold text-cyan-800">
                  Rendimento
                </dt>
                <dd className="font-bold tabular-nums text-cyan-950">
                  {fuelInfo?.kmPerL != null
                    ? `${fuelInfo.kmPerL.toFixed(2)} km/L`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Combustível</dt>
                <dd className="font-semibold tabular-nums">
                  {fuelInfo?.fuelLevelPct != null
                    ? `${Math.round(fuelInfo.fuelLevelPct)}%`
                    : selected.fuelLevelPct != null
                      ? `${Math.round(selected.fuelLevelPct)}%`
                      : "—"}
                  {fuelInfo?.liters != null
                    ? ` · ${fuelInfo.liters.toFixed(1)} L`
                    : ""}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Parado</dt>
                <dd className="font-semibold tabular-nums">
                  {idleMs != null ? formatIdle(idleMs) : "Em movimento"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Direção</dt>
                <dd className="font-semibold tabular-nums">
                  {selected.heading != null
                    ? `${Math.round(selected.heading)}°`
                    : "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Ignição</dt>
                <dd className="font-semibold">
                  {selected.ignition === true
                    ? "Ligada"
                    : selected.ignition === false
                      ? "Desligada"
                      : "—"}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <dt className="text-[11px] text-text-secondary">Sinal</dt>
                <dd className="font-semibold">{statusLabel(selected.status)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-text-secondary">
              {addressLoading
                ? "Buscando endereço…"
                : address
                  ? address
                  : "Endereço indisponível"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Última posição: {selected.when}
              {Number.isFinite(selected.lat) && Number.isFinite(selected.lng)
                ? ` · ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
                : ""}
            </p>
            {showTrail && (
              <p className="mt-1 text-xs text-text-secondary">
                {trailPath.length > 1
                  ? `Rastro atrás da placa: ${trailPath.length} pontos`
                  : "Rastro começa a desenhar conforme a placa anda."}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to={`/telemetria/historico?caminhao=${selected.id}`}
                className="inline-flex min-h-9 items-center rounded-lg bg-secondary px-3 text-xs font-semibold text-white hover:bg-secondary-dark"
              >
                Histórico completo
              </Link>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
