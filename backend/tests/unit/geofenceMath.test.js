import test from "node:test";
import assert from "node:assert/strict";
import {
  haversineMeters,
  isInsideGeofence,
  pointInPolygon,
} from "../../src/services/telemetry/geofenceMath.js";

test("circle geofence contains center", () => {
  const fence = {
    shape: "circle",
    geometry: { center: { lat: -25.4284, lng: -49.2733 }, radius_m: 500 },
  };
  assert.equal(
    isInsideGeofence({ lat: -25.4284, lng: -49.2733 }, fence),
    true,
  );
  assert.equal(
    isInsideGeofence({ lat: -25.5, lng: -49.4 }, fence),
    false,
  );
  assert.ok(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }) === 0);
});

test("polygon geofence ray casting", () => {
  const points = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 2 },
    { lat: 2, lng: 2 },
    { lat: 2, lng: 0 },
  ];
  assert.equal(pointInPolygon({ lat: 1, lng: 1 }, points), true);
  assert.equal(pointInPolygon({ lat: 3, lng: 3 }, points), false);
  assert.equal(
    isInsideGeofence(
      { lat: 1, lng: 1 },
      { shape: "polygon", geometry: { points } },
    ),
    true,
  );
});
