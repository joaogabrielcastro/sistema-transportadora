import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Circle, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FLEET_MAP_STYLES } from "./mapStyles.js";

function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
    },
  });
  return null;
}

ClickCapture.propTypes = { onPick: PropTypes.func.isRequired };

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [center, map]);
  return null;
}

FlyTo.propTypes = { center: PropTypes.object };

/**
 * Mapa para criar geocerca: clique define o centro, o raio aparece como
 * prévia e as geocercas existentes ficam visíveis para evitar sobreposição.
 */
export default function GeofencePickerMap({ center, radiusM, existing = [], onPick, focus }) {
  const style = FLEET_MAP_STYLES.modern;
  const initial = center || existing[0]?.geometry?.center || { lat: -25.4284, lng: -49.2733 };
  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={12}
      className="h-full w-full cursor-crosshair"
      scrollWheelZoom
    >
      <TileLayer url={style.url} attribution={style.attribution} />
      <ClickCapture onPick={onPick} />
      <FlyTo center={focus} />
      {existing
        .filter((g) => g.shape === "circle" && g.geometry?.center)
        .map((g) => (
          <Circle
            key={g.id}
            center={[g.geometry.center.lat, g.geometry.center.lng]}
            radius={Number(g.geometry.radius_m) || 0}
            pathOptions={{ color: "#64748B", weight: 1.5, fillOpacity: 0.08, dashArray: "4 4" }}
          >
            <Tooltip direction="top">{g.name}</Tooltip>
          </Circle>
        ))}
      {center && radiusM > 0 ? (
        <Circle
          center={[center.lat, center.lng]}
          radius={radiusM}
          pathOptions={{ color: "#0891B2", weight: 2, fillOpacity: 0.18 }}
        />
      ) : null}
    </MapContainer>
  );
}

GeofencePickerMap.propTypes = {
  center: PropTypes.shape({ lat: PropTypes.number, lng: PropTypes.number }),
  radiusM: PropTypes.number,
  existing: PropTypes.array,
  onPick: PropTypes.func.isRequired,
  focus: PropTypes.object,
};
