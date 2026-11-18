import React, { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  Polygon,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FLEET_MAP_STYLES } from "./mapStyles.js";

const BRAZIL_CENTER = [-14.235, -51.9253];

/** Cores do design system ATrack (tailwind.config). */
const BRAND = {
  primary: "#0F172A",
  secondary: "#0891B2",
  secondaryDark: "#0E7490",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  muted: "#64748B",
};

const MAP_STYLES = FLEET_MAP_STYLES;

function markerColor(marker) {
  if (marker.status === "offline") return BRAND.danger;
  if (marker.status === "awaiting") return BRAND.warning;
  if (marker.moving) return BRAND.secondary;
  if (marker.status === "online") return BRAND.success;
  return BRAND.muted;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildVehicleIcon(marker, selected) {
  const color = markerColor(marker);
  const plate = escapeHtml((marker.label || "?").slice(0, 10).toUpperCase());
  const speed =
    marker.speedKmh != null && Number.isFinite(Number(marker.speedKmh))
      ? `${Math.round(Number(marker.speedKmh))} km/h`
      : "";
  const heading =
    marker.heading != null && Number.isFinite(Number(marker.heading))
      ? Number(marker.heading)
      : null;
  const ring = selected
    ? `0 0 0 3px rgba(8,145,178,.35)`
    : "0 8px 20px rgba(15,23,42,.28)";
  // Ponta preta = lat/lng (fim do rastro). Rotação em torno da ponta (0° = norte).
  const tipColor = BRAND.primary;
  const tip = heading != null
    ? `<div style="
        position:absolute;left:50%;top:0;width:0;height:0;
        margin-left:-7px;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-bottom:14px solid ${tipColor};
        transform:rotate(${heading}deg);
        transform-origin:50% 0%;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));
      "></div>`
    : `<div style="
        position:absolute;left:50%;top:0;width:12px;height:12px;
        margin-left:-6px;margin-top:-6px;
        border-radius:999px;background:${tipColor};
        border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
      "></div>`;

  // Layout absoluto: placa acima da ponta; iconAnchor cai exatamente na flecha.
  const W = 104;
  const H = 72;
  const tipY = 58;
  const html = `
    <div style="position:relative;width:${W}px;height:${H}px;pointer-events:none;">
      <div style="
        position:absolute;left:50%;bottom:${H - tipY + 16}px;
        transform:translateX(-50%);
        min-width:82px;
        background:linear-gradient(180deg,${BRAND.primary} 0%,#1e293b 100%);
        color:#fff;
        border:2px solid ${color};
        border-radius:10px;
        box-shadow:${ring};
        padding:5px 8px 4px;
        text-align:center;
        line-height:1.15;
        pointer-events:auto;
      ">
        <div style="font:700 12px/1.1 ui-sans-serif,system-ui,Segoe UI,sans-serif;letter-spacing:.06em;">${plate}</div>
        ${
          speed
            ? `<div style="margin-top:2px;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;color:#67e8f9;">${speed}</div>`
            : ""
        }
      </div>
      <div style="position:absolute;left:0;top:${tipY}px;width:${W}px;height:0;">${tip}</div>
    </div>
  `;
  return L.divIcon({
    className: "fleet-map-marker",
    html,
    iconSize: [W, H],
    iconAnchor: [W / 2, tipY],
    popupAnchor: [0, -(tipY - 8)],
  });
}

function FitBounds({ points, selected, path, followSelected, selectedId }) {
  const map = useMap();
  const selectedKey = selectedId == null ? "" : String(selectedId);
  const pathLen = path?.length || 0;

  useEffect(() => {
    // No monitoramento ao vivo com "Seguir", só centra a placa (não enquadra o rastro inteiro).
    if (followSelected && selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {
      map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 14));
      return;
    }
    if (pathLen > 1) {
      map.fitBounds(path, { padding: [80, 80], maxZoom: 15 });
      return;
    }
    if (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {
      map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 14));
      return;
    }
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [80, 80], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedKey, followSelected]);

  useEffect(() => {
    if (!followSelected) return;
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) return;
    map.panTo([selected.lat, selected.lng], { animate: true });
  }, [map, followSelected, selected?.lat, selected?.lng, selectedKey]);

  return null;
}

function AnimatedMarker({ marker, selected, onSelect }) {
  const markerRef = useRef(null);
  const posRef = useRef([marker.lat, marker.lng]);
  const icon = useMemo(
    () => buildVehicleIcon(marker, selected),
    [
      marker.label,
      marker.status,
      marker.moving,
      marker.speedKmh,
      marker.heading,
      selected,
    ],
  );

  useEffect(() => {
    const leafletMarker = markerRef.current;
    if (!leafletMarker) return undefined;
    const start = posRef.current;
    const end = [marker.lat, marker.lng];
    if (
      !Number.isFinite(end[0]) ||
      !Number.isFinite(end[1]) ||
      !Number.isFinite(start[0]) ||
      !Number.isFinite(start[1])
    ) {
      posRef.current = end;
      return undefined;
    }
    const dist = Math.abs(end[0] - start[0]) + Math.abs(end[1] - start[1]);
    if (dist < 0.000001) {
      posRef.current = end;
      return undefined;
    }
    // Teleporte / novo ciclo de rota: vai direto, sem rastro “fantasma”.
    if (dist > 0.03) {
      leafletMarker.setLatLng(end);
      posRef.current = end;
      return undefined;
    }

    const duration = 1800;
    const t0 = performance.now();
    let raf = 0;
    let cancelled = false;
    const tick = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / duration);
      const ease = 1 - (1 - t) ** 3;
      const lat = start[0] + (end[0] - start[0]) * ease;
      const lng = start[1] + (end[1] - start[1]) * ease;
      leafletMarker.setLatLng([lat, lng]);
      posRef.current = [lat, lng];
      if (t < 1) raf = requestAnimationFrame(tick);
      else posRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [marker.lat, marker.lng]);

  useEffect(() => {
    markerRef.current?.setIcon(icon);
  }, [icon]);

  return (
    <Marker
      // Posição inicial; o movimento contínuo é feito via setLatLng (evita 2 marcadores).
      position={posRef.current}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      ref={markerRef}
      eventHandlers={{
        click: () => onSelect?.(marker.id),
      }}
    >
      <Popup>
        <div className="min-w-[140px]">
          <div className="text-sm font-bold tracking-wide">{marker.label || "Veículo"}</div>
          {marker.subtitle ? (
            <div className="mt-0.5 text-xs text-slate-600">{marker.subtitle}</div>
          ) : null}
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * @param {{
 *   markers?: Array<{ id: string|number, lat: number, lng: number, label?: string, subtitle?: string, status?: string, moving?: boolean, speedKmh?: number|null }>,
 *   path?: Array<[number, number]>,
 *   selectedId?: string|number|null,
 *   onSelect?: (id: string|number) => void,
 *   mapStyle?: keyof typeof MAP_STYLES,
 *   followSelected?: boolean,
 *   geofences?: Array<{ id: string|number, name?: string, shape?: string, geometry?: object, enabled?: boolean }>,
 *   className?: string,
 *   height?: string,
 * }} props
 */
export default function FleetMap({
  markers = [],
  path = [],
  selectedId = null,
  onSelect,
  mapStyle = "modern",
  followSelected = false,
  geofences = [],
  className = "",
  height = "420px",
}) {
  const style = MAP_STYLES[mapStyle] || MAP_STYLES.modern;

  const points = useMemo(() => {
    const fromMarkers = markers
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .map((m) => [m.lat, m.lng]);
    if (fromMarkers.length) return fromMarkers;
    return (path || []).filter(
      (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
  }, [markers, path]);

  const selected = useMemo(
    () => markers.find((m) => String(m.id) === String(selectedId)) || null,
    [markers, selectedId],
  );

  const trailColor = selected ? markerColor(selected) : BRAND.secondary;

  return (
    <div
      className={`fleet-map overflow-hidden bg-slate-200 ${
        className.includes("rounded-none")
          ? ""
          : "rounded-xl border border-border"
      } ${className}`}
      style={{ height }}
    >
      <style>{`
        .fleet-map .leaflet-div-icon{background:transparent;border:0;}
        .fleet-map .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.75);}
        .fleet-map .leaflet-control-zoom a{
          color:${BRAND.primary};
          border-color:#DDE5ED;
        }
      `}</style>
      <MapContainer
        center={points[0] || BRAZIL_CENTER}
        zoom={points.length ? 13 : 4}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          key={mapStyle}
          attribution={style.attribution}
          url={style.url}
          {...(style.subdomains ? { subdomains: style.subdomains } : {})}
          maxZoom={19}
        />
        <ZoomControlBottomRight />
        <FitBounds
          points={points}
          selected={selected}
          selectedId={selectedId}
          path={path}
          followSelected={followSelected}
        />

        {geofences
          .filter((g) => g && g.enabled !== false)
          .map((g) => {
            if (g.shape === "circle") {
              const lat = Number(g.geometry?.center?.lat);
              const lng = Number(g.geometry?.center?.lng);
              const radius = Number(g.geometry?.radius_m);
              if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                !Number.isFinite(radius) ||
                radius <= 0
              ) {
                return null;
              }
              return (
                <Circle
                  key={`gf-${g.id}`}
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{
                    color: BRAND.secondaryDark,
                    weight: 2,
                    fillColor: BRAND.secondary,
                    fillOpacity: 0.12,
                  }}
                >
                  <Popup>
                    <div className="text-sm font-semibold">{g.name || "Geocerca"}</div>
                    <div className="text-xs text-slate-600">
                      Raio {Math.round(radius)} m
                    </div>
                  </Popup>
                </Circle>
              );
            }
            if (g.shape === "polygon" && Array.isArray(g.geometry?.points)) {
              const positions = g.geometry.points
                .map((p) => [Number(p.lat), Number(p.lng)])
                .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
              if (positions.length < 3) return null;
              return (
                <Polygon
                  key={`gf-${g.id}`}
                  positions={positions}
                  pathOptions={{
                    color: BRAND.secondaryDark,
                    weight: 2,
                    fillColor: BRAND.secondary,
                    fillOpacity: 0.12,
                  }}
                >
                  <Popup>
                    <div className="text-sm font-semibold">{g.name || "Geocerca"}</div>
                  </Popup>
                </Polygon>
              );
            }
            return null;
          })}

        {path.length > 1 ? (
          <>
            <Polyline
              positions={path}
              pathOptions={{
                color: BRAND.primary,
                weight: 7,
                opacity: 0.14,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={path}
              pathOptions={{
                color: trailColor,
                weight: 4,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        ) : null}

        {markers.map((m) =>
          Number.isFinite(m.lat) && Number.isFinite(m.lng) ? (
            <AnimatedMarker
              key={m.id}
              marker={m}
              selected={String(m.id) === String(selectedId)}
              onSelect={onSelect}
            />
          ) : null,
        )}
      </MapContainer>
    </div>
  );
}

function ZoomControlBottomRight() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({ position: "bottomright" });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);
  return null;
}

