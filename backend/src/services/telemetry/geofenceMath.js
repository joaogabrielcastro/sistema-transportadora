/** Distância haversine em metros. */
export function haversineMeters(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray casting para polígono. */
export function pointInPolygon(point, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = Number(points[i].lng);
    const yi = Number(points[i].lat);
    const xj = Number(points[j].lng);
    const yj = Number(points[j].lat);
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * @param {{ lat: number, lng: number }} point
 * @param {{ shape: string, geometry: object }} fence
 */
export function isInsideGeofence(point, fence) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return false;
  }
  const shape = String(fence.shape || "").toLowerCase();
  const g = fence.geometry || {};
  if (shape === "circle") {
    const center = g.center || {};
    const radius = Number(g.radius_m);
    if (!Number.isFinite(radius) || radius <= 0) return false;
    const c = { lat: Number(center.lat), lng: Number(center.lng) };
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
    return haversineMeters(point, c) <= radius;
  }
  if (shape === "polygon") {
    return pointInPolygon(point, g.points || []);
  }
  return false;
}
