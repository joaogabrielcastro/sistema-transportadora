import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import { Alert, Button } from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import { useToast } from "../../components/ui/useToast.js";
import FleetMap from "../../components/telemetria/FleetMap.jsx";
import { FLEET_MAP_STYLES } from "../../components/telemetria/mapStyles.js";
import { useCaminhoesListQuery } from "../../hooks/queries/useCaminhoesQuery.js";
import {
  useResolveTelemetryAlertMutation,
  useTelemetryAlertsQuery,
  useTelemetryCurrentQuery,
  useTelemetryGeofencesQuery,
} from "../../hooks/queries/useTelemetryQueries.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { parseApiError } from "../../lib/apiClient.js";
import {
  VEHICLE_STATUS,
  googleMapsUrl,
  kmPerLiter,
  relativeTime,
  vehicleStatus,
} from "../../utils/telemetryDisplay.js";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "moving", label: "Em movimento" },
  { id: "idle", label: "Parado ligado" },
  { id: "off", label: "Desligados" },
  { id: "offline", label: "Sem sinal" },
];

const POLL_MS = 4_000;

function distApprox(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

async function reverseGeocode(lat, lng) {
  // Client-side friendly (sem API key). Suficiente para demo/piloto.
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    lat,
  )}&longitude=${encodeURIComponent(lng)}&localityLanguage=pt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  const parts = [data?.locality, data?.city, data?.principalSubdivision].filter(Boolean);
  return [...new Set(parts)].join(", ") || null;
}

function toRow(row, motoristaById) {
  const speedKmh = row.velocidade_kmh != null ? Number(row.velocidade_kmh) : null;
  const status = vehicleStatus({
    connection: row.connection_status,
    speedKmh,
    ignition: row.ignicao,
  });
  return {
    id: row.caminhao_id,
    lat: row.latitude != null ? Number(row.latitude) : null,
    lng: row.longitude != null ? Number(row.longitude) : null,
    label: row.placa || `Veículo #${row.caminhao_id}`,
    // Mantém o contrato do FleetMap (cor do marcador).
    status: row.connection_status,
    moving: status === "moving",
    vstatus: status,
    ignition: row.ignicao,
    speedKmh,
    heading: row.heading != null ? Number(row.heading) : null,
    odometerKm: row.odometro_km != null ? Number(row.odometro_km) : null,
    fuelConsumedL: row.fuel_consumed_l != null ? Number(row.fuel_consumed_l) : null,
    fuelLevelPct: row.fuel_level_pct != null ? Number(row.fuel_level_pct) : null,
    rpm: row.engine_rpm != null ? Number(row.engine_rpm) : null,
    engineTempC: row.engine_temp_c != null ? Number(row.engine_temp_c) : null,
    batteryV: row.battery_v != null ? Number(row.battery_v) : null,
    rawWhen: row.registrado_em,
    motorista: motoristaById.get(row.caminhao_id) || null,
    subtitle: [
      speedKmh != null ? `${Math.round(speedKmh)} km/h` : null,
      VEHICLE_STATUS[status]?.label,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function StatusDot({ status, pulse = false }) {
  const s = VEHICLE_STATUS[status] || VEHICLE_STATUS.off;
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" aria-hidden>
      {pulse ? <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${s.dot}`} /> : null}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
    </span>
  );
}

function Metric({ label, value, hint, warn = false }) {
  return (
    <div className={`rounded-lg px-2.5 py-2 ${warn ? "bg-red-50 ring-1 ring-red-100" : "bg-slate-50"}`}>
      <dt className="text-[11px] text-text-secondary">{label}</dt>
      <dd className={`font-semibold tabular-nums ${warn ? "text-red-700" : "text-text-primary"}`}>{value}</dd>
      {hint ? <p className="text-[11px] text-text-secondary">{hint}</p> : null}
    </div>
  );
}

const ALERT_TYPE_LABEL = {
  speed: "Excesso de velocidade",
  offline: "Rastreador sem sinal",
  geofence_enter: "Entrou em geocerca",
  geofence_exit: "Saiu de geocerca",
  engine_temp: "Temperatura do motor",
  ignition_on: "Ignição ligada",
  ignition_off: "Ignição desligada",
};

/**
 * Console operacional: mapa em tela cheia, lista da frota com um status claro
 * por veículo, painel de detalhe e alertas abertos da telemetria.
 */
export default function TelemetriaMonitoramento() {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.TELEMETRY_WRITE);
  const { data: current = [], isLoading, error, refetch, dataUpdatedAt } =
    useTelemetryCurrentQuery({}, { refetchInterval: POLL_MS });
  const { data: caminhoesRes } = useCaminhoesListQuery({ page: 1, limit: 200 });
  const { data: geofences = [] } = useTelemetryGeofencesQuery();
  const { data: openAlerts = [] } = useTelemetryAlertsQuery(
    { status: "open" },
    { refetchInterval: 30_000 },
  );
  const resolveMut = useResolveTelemetryAlertMutation();

  const [searchParams] = useSearchParams();
  // ?caminhao=ID (vindo da ficha do veículo) abre já com ele selecionado.
  const [selectedId, setSelectedId] = useState(() => searchParams.get("caminhao") || null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  // No celular o mapa vem primeiro; a lista abre pelo botão "Lista".
  const [listOpen, setListOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1024,
  );
  const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 1024;
  const pickVehicle = (id) => {
    setSelectedId(id);
    if (isNarrow()) setListOpen(false);
  };
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState("modern");
  const [followSelected, setFollowSelected] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  /** Rastro ao vivo: só o que a placa já percorreu nesta sessão. */
  const [liveTrails, setLiveTrails] = useState({});
  /** Consumo desde que a tela foi aberta (contador de combustível do rastreador). */
  const [sessionFuel, setSessionFuel] = useState({});
  const [now, setNow] = useState(Date.now());
  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  const motoristaById = useMemo(() => {
    const map = new Map();
    for (const t of caminhoesRes?.data || []) {
      if (t.motorista) map.set(t.id, t.motorista);
    }
    return map;
  }, [caminhoesRes]);

  const rows = useMemo(
    () => current.map((r) => toRow(r, motoristaById)),
    [current, motoristaById],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (selectedId != null || !rows.length) return;
    const first =
      rows.find((r) => r.vstatus === "moving" && Number.isFinite(r.lat)) ||
      rows.find((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    if (first) setSelectedId(first.id);
  }, [rows, selectedId]);

  useEffect(() => {
    setLiveTrails((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
        const point = [row.lat, row.lng];
        const list = next[row.id] || [];
        const last = list[list.length - 1];
        if (!last || distApprox(last, point) > 0.025) {
          next[row.id] = [point];
          changed = true;
          continue;
        }
        if (distApprox(last, point) < 0.00002) continue;
        next[row.id] = [...list.slice(-180), point];
        changed = true;
      }
      return changed ? next : prev;
    });

    setSessionFuel((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const row of rows) {
        const cur = next[row.id] || { startOdo: row.odometerKm, startFuelL: row.fuelConsumedL };
        if (cur.startOdo == null && row.odometerKm != null) cur.startOdo = row.odometerKm;
        if (cur.startFuelL == null && row.fuelConsumedL != null) cur.startFuelL = row.fuelConsumedL;
        const km = cur.startOdo != null && row.odometerKm != null ? Math.max(0, row.odometerKm - cur.startOdo) : null;
        const liters = cur.startFuelL != null && row.fuelConsumedL != null ? Math.max(0, row.fuelConsumedL - cur.startFuelL) : null;
        const updated = { ...cur, km, liters, kmPerL: km != null && liters != null && liters > 0.05 ? km / liters : null };
        if (JSON.stringify(updated) !== JSON.stringify(next[row.id])) {
          next[row.id] = updated;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const counts = useMemo(() => {
    const c = { all: rows.length, moving: 0, idle: 0, off: 0, offline: 0 };
    for (const r of rows) {
      if (r.vstatus === "awaiting" || r.vstatus === "offline") c.offline += 1;
      else c[r.vstatus] += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = { moving: 0, idle: 1, off: 2, offline: 3, awaiting: 4 };
    return rows
      .filter((row) => {
        if (filter === "offline" && !(row.vstatus === "offline" || row.vstatus === "awaiting")) return false;
        if (filter !== "all" && filter !== "offline" && row.vstatus !== filter) return false;
        if (q && !`${row.label} ${row.motorista || ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => order[a.vstatus] - order[b.vstatus] || String(a.label).localeCompare(String(b.label)));
  }, [rows, filter, query]);

  const selected = rows.find((r) => String(r.id) === String(selectedId)) || null;
  const alertsBySelected = selected
    ? openAlerts.filter((a) => Number(a.caminhao_id) === Number(selected.id))
    : [];
  const alertsByTruck = useMemo(() => {
    const m = new Map();
    for (const a of openAlerts) m.set(Number(a.caminhao_id), (m.get(Number(a.caminhao_id)) || 0) + 1);
    return m;
  }, [openAlerts]);

  // Endereço só é buscado de novo quando o veículo anda ~100 m.
  const latKey = selected?.lat != null ? selected.lat.toFixed(3) : null;
  const lngKey = selected?.lng != null ? selected.lng.toFixed(3) : null;
  useEffect(() => {
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, latKey, lngKey]);

  const mapMarkers = useMemo(() => {
    const base = filtered.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    if (selected && Number.isFinite(selected.lat) && !base.some((r) => String(r.id) === String(selected.id))) {
      return [...base, selected];
    }
    return base;
  }, [filtered, selected]);

  const trailPath = showTrail && selected ? liveTrails[selected.id] || [] : [];
  const fuelInfo = selected ? sessionFuel[selected.id] : null;
  const sessionKmL = kmPerLiter(fuelInfo?.kmPerL);
  const lastUpdateSec = dataUpdatedAt ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : null;

  const resolveAlert = async (id) => {
    try {
      await resolveMut.mutateAsync(id);
      toast.success("Alerta marcado como resolvido.");
    } catch (err) {
      toast.error((await parseApiError(err)).message || "Não foi possível resolver o alerta.");
    }
  };

  const toggleClass = (on) =>
    `inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
      on ? "bg-primary text-white" : "bg-slate-100 text-text-secondary hover:bg-slate-200"
    }`;

  return (
    <PageLayout flush className="flex flex-col">
      <div className="relative min-h-[calc(100dvh-3.5rem)] flex-1 lg:min-h-[calc(100dvh-60px)]">
        {error && (
          <div className="absolute left-3 right-3 top-[4.5rem] z-[1000] sm:left-4 sm:right-auto sm:w-[380px]">
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

        {/* Barra superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-4">
          <div className="scrollbar-thin pointer-events-auto flex items-center gap-2 overflow-x-auto rounded-xl border border-border/80 bg-white/95 p-2 shadow-lg backdrop-blur lg:flex-wrap lg:overflow-visible">
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 lg:hidden"
              aria-expanded={listOpen}
              onClick={() => setListOpen((v) => !v)}
            >
              <Icon name="list" className="h-3.5 w-3.5" />
              {listOpen ? "Mapa" : "Lista"}
            </button>
            <div className="flex shrink-0 gap-1.5 lg:min-w-0 lg:flex-1 lg:flex-wrap" role="group" aria-label="Filtrar veículos por situação">
              {FILTERS.map((f) => {
                const n = counts[f.id] ?? 0;
                const active = filter === f.id;
                const s = VEHICLE_STATUS[f.id === "offline" ? "offline" : f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.id)}
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                      active ? "bg-primary text-white" : "bg-slate-100 text-text-secondary hover:bg-slate-200"
                    }`}
                  >
                    {s && f.id !== "all" ? <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden /> : null}
                    {f.label}
                    <span className={`tabular-nums ${active ? "text-white/70" : "text-text-light"}`}>{n}</span>
                  </button>
                );
              })}
            </div>
            {openAlerts.length > 0 ? (
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                aria-expanded={alertsOpen}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-red-50 px-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
              >
                <Icon name="bell" className="h-3.5 w-3.5" />
                {openAlerts.length} alerta{openAlerts.length === 1 ? "" : "s"}
              </button>
            ) : null}
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" aria-pressed={showTrail} onClick={() => setShowTrail((v) => !v)} className={toggleClass(showTrail)} title="Mostrar o caminho percorrido desde que a tela foi aberta">
                <Icon name="route" className="h-3.5 w-3.5" /> Rastro
              </button>
              <button type="button" aria-pressed={followSelected} onClick={() => setFollowSelected((v) => !v)} className={toggleClass(followSelected)} title="Manter o veículo selecionado centralizado">
                <Icon name="eye" className="h-3.5 w-3.5" /> Seguir
              </button>
              <select
                className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-semibold text-text-secondary"
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
            </div>
            <span className="hidden items-center gap-1.5 text-[11px] text-text-secondary xl:inline-flex" title="As posições atualizam automaticamente">
              <StatusDot status="moving" pulse />
              Ao vivo{lastUpdateSec != null && lastUpdateSec > 20 ? ` · ${lastUpdateSec}s` : ""}
            </span>
          </div>
        </div>

        {/* Alertas abertos */}
        {alertsOpen && openAlerts.length > 0 ? (
          <div className="absolute right-3 top-[4.5rem] z-[600] max-h-[50vh] w-[min(100%-1.5rem,380px)] overflow-hidden rounded-xl border border-border bg-white shadow-pop sm:right-4 sm:top-[5rem]">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold text-text-primary">Alertas abertos</p>
              <button type="button" className="text-xs text-text-secondary hover:text-text-primary" onClick={() => setAlertsOpen(false)}>
                Fechar
              </button>
            </div>
            <ul className="scrollbar-thin max-h-[calc(50vh-3rem)] divide-y divide-border overflow-y-auto">
              {openAlerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      pickVehicle(a.caminhao_id);
                      setAlertsOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {a.placa ? <span className="plate !text-[11px]">{a.placa}</span> : null}
                      <span className="truncate text-sm font-medium text-text-primary">{ALERT_TYPE_LABEL[a.alert_type] || a.alert_type}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-text-secondary">
                      {a.description} · {relativeTime(a.occurred_at, now)}
                    </span>
                  </button>
                  {canWrite ? (
                    <Button size="xs" variant="outline" onClick={() => resolveAlert(a.id)} disabled={resolveMut.isPending}>
                      Resolver
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Lista da frota */}
        {listOpen && (
          <aside className="absolute bottom-3 left-3 top-[4.5rem] z-[500] flex w-[min(100%-1.5rem,320px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur sm:left-4 sm:top-[5rem]">
            <div className="border-b border-border p-2">
              <label htmlFor="tel-busca" className="sr-only">Buscar placa ou motorista</label>
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  id="tel-busca"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Placa ou motorista…"
                  className="h-9 w-full rounded-lg border border-border bg-white pl-8 pr-3 text-sm outline-none focus:border-secondary focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>

            <ul className="scrollbar-thin min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {!filtered.length ? (
                <li className="px-4 py-8 text-center text-sm text-text-secondary">
                  {isLoading ? (
                    "Carregando frota…"
                  ) : rows.length === 0 ? (
                    <>
                      Nenhum veículo com rastreador ainda.{" "}
                      <Link to="/telemetria/dispositivos" className="font-semibold text-secondary-dark hover:underline">
                        Cadastrar dispositivo
                      </Link>
                    </>
                  ) : (
                    "Nenhum veículo neste filtro."
                  )}
                </li>
              ) : (
                filtered.map((row) => {
                  const active = String(row.id) === String(selectedId);
                  const s = VEHICLE_STATUS[row.vstatus];
                  const onMap = Number.isFinite(row.lat) && Number.isFinite(row.lng);
                  const nAlerts = alertsByTruck.get(Number(row.id)) || 0;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => pickVehicle(row.id)}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-cyan-50/80" : "hover:bg-slate-50"
                        }`}
                      >
                        <StatusDot status={row.vstatus} pulse={row.vstatus === "moving"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="plate !text-[12px]">{row.label}</span>
                            {nAlerts ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1 text-[10px] font-bold text-red-700" title={`${nAlerts} alerta(s) aberto(s)`}>
                                <Icon name="bell" className="h-3 w-3" />
                                {nAlerts}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block truncate text-xs text-text-secondary">
                            {row.motorista || "Sem motorista"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-xs font-semibold ${s.tone}`}>
                            {row.vstatus === "moving" && row.speedKmh != null ? `${Math.round(row.speedKmh)} km/h` : s.label}
                          </span>
                          <span className="block text-[11px] text-text-light">
                            {onMap ? relativeTime(row.rawWhen, now) : "sem GPS"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
              <span className="text-text-secondary">
                {filtered.length} de {rows.length} veículo(s)
              </span>
              <Link to="/telemetria/historico" className="font-semibold text-secondary-dark hover:underline">
                Histórico →
              </Link>
            </div>
          </aside>
        )}

        {/* Detalhe do veículo */}
        {selected && !(listOpen && isNarrow()) && (() => {
          const s = VEHICLE_STATUS[selected.vstatus];
          const mapsUrl = googleMapsUrl(selected.lat, selected.lng);
          const hot = selected.engineTempC != null && selected.engineTempC >= 105;
          return (
            <div className="absolute bottom-3 left-3 right-3 z-[500] max-h-[70vh] overflow-y-auto rounded-xl border border-border/80 bg-white/95 shadow-xl backdrop-blur sm:left-auto sm:right-4 sm:w-[340px]">
              <div className="flex items-start justify-between gap-2 border-b border-border p-4 pb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="plate plate-lg !text-base">{selected.label}</span>
                  </div>
                  <p className="mt-1.5 truncate text-xs text-text-secondary">
                    <Icon name="user" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                    {selected.motorista || "Sem motorista vinculado"}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-light hover:bg-slate-100 hover:text-text-primary"
                  onClick={() => setSelectedId(null)}
                  aria-label="Fechar detalhe"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.chip}`}>
                    <StatusDot status={selected.vstatus} pulse={selected.vstatus === "moving"} />
                    {s.label}
                  </span>
                  <span className="text-xs text-text-secondary" title={selected.rawWhen ? new Date(selected.rawWhen).toLocaleString("pt-BR") : undefined}>
                    Última posição {relativeTime(selected.rawWhen, now)}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Velocidade" value={selected.speedKmh != null ? `${Math.round(selected.speedKmh)} km/h` : "—"} />
                  <Metric
                    label="Combustível"
                    value={selected.fuelLevelPct != null ? `${Math.round(selected.fuelLevelPct)}%` : "—"}
                    warn={selected.fuelLevelPct != null && selected.fuelLevelPct <= 15}
                    hint={selected.fuelLevelPct != null && selected.fuelLevelPct <= 15 ? "Nível baixo" : null}
                  />
                  <Metric
                    label="Hodômetro"
                    value={selected.odometerKm != null ? `${selected.odometerKm.toLocaleString("pt-BR")} km` : "—"}
                  />
                  {selected.engineTempC != null ? (
                    <Metric label="Temp. motor" value={`${Math.round(selected.engineTempC)} °C`} warn={hot} hint={hot ? "Acima do limite" : null} />
                  ) : (
                    <Metric label="RPM" value={selected.rpm != null ? selected.rpm.toLocaleString("pt-BR") : "—"} />
                  )}
                  {fuelInfo?.km != null && fuelInfo.km > 1 ? (
                    <div className="col-span-2">
                      <Metric
                        label="Desde que abriu esta tela"
                        value={`${fuelInfo.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km${
                          sessionKmL.value != null
                            ? ` · ${sessionKmL.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km/L`
                            : ""
                        }`}
                        hint={sessionKmL.value != null && !sessionKmL.plausible ? "Consumo fora da faixa esperada — verifique o sensor." : null}
                      />
                    </div>
                  ) : null}
                </dl>

                {alertsBySelected.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {alertsBySelected.slice(0, 3).map((a) => (
                      <li key={a.id} className="flex items-start gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-800">
                        <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1">{a.description} · {relativeTime(a.occurred_at, now)}</span>
                        {canWrite ? (
                          <button type="button" className="shrink-0 font-semibold underline-offset-2 hover:underline" onClick={() => resolveAlert(a.id)}>
                            Resolver
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="mt-3 flex items-start gap-1.5 text-xs text-text-secondary">
                  <Icon name="map" className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    {addressLoading ? "Buscando endereço…" : address || "Endereço indisponível"}
                    {mapsUrl ? (
                      <>
                        {" · "}
                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-secondary-dark hover:underline">
                          Abrir no Google Maps
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    to={`/telemetria/historico?caminhao=${selected.id}`}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-light"
                  >
                    <Icon name="clock" className="h-3.5 w-3.5" /> Trajeto do dia
                  </Link>
                  <Link
                    to={`/caminhao/${encodeURIComponent(selected.label)}`}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-primary hover:bg-slate-50"
                  >
                    <Icon name="truck" className="h-3.5 w-3.5" /> Ficha do veículo
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </PageLayout>
  );
}
