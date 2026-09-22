#!/usr/bin/env node
/**
 * Simula um rastreador contra a ingestão local.
 *
 *   TELEMETRY_DEVICE_CREDENTIAL=... npm run telemetry:simulate -- --count 100
 *
 * A credencial vem do ambiente. Não há segredo padrão no código.
 */
import "dotenv/config";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const count = Number(arg("count", "10"));
const credential = String(process.env.TELEMETRY_DEVICE_CREDENTIAL || "").trim();
const base = String(process.env.TELEMETRY_API_URL || "http://localhost:3020").replace(
  /\/$/,
  "",
);

if (!credential) {
  console.error(
    "Defina TELEMETRY_DEVICE_CREDENTIAL no ambiente. O simulador não embute credencial.",
  );
  process.exit(1);
}

if (!Number.isInteger(count) || count <= 0 || count > 5000) {
  console.error("--count deve ser um inteiro entre 1 e 5000.");
  process.exit(1);
}

const started = Date.now();
let queued = 0;
let duplicate = 0;
let failed = 0;

for (let i = 0; i < count; i += 1) {
  const recorded = new Date(started + i * 1000).toISOString();
  const eventId = `sim-${started.toString(36)}-${i}`;
  const response = await fetch(`${base}/api/v1/telemetry/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Device ${credential}`,
    },
    body: JSON.stringify({
      event_id: eventId,
      recorded_at: recorded,
      latitude: -25.4284 + i * 0.0001,
      longitude: -49.2733,
      speed_kmh: 40 + (i % 30),
      ignition: true,
    }),
  });

  if (response.status === 202) queued += 1;
  else if (response.status === 200) duplicate += 1;
  else {
    failed += 1;
    const text = await response.text();
    console.error(`falha ${eventId} HTTP ${response.status} ${text.slice(0, 180)}`);
  }
}

console.log(
  JSON.stringify({
    count,
    queued,
    duplicate,
    failed,
  }),
);

process.exit(failed > 0 ? 1 : 0);
