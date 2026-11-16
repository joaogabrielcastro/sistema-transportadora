/**
 * Prepara demo local: device(s) + vínculo + pontos simulados no tenant.
 *
 *   node scripts/_enable-telemetry-demo.mjs
 *   node scripts/_enable-telemetry-demo.mjs --vehicles=2
 *   node scripts/_enable-telemetry-demo.mjs --slug=trans-motin
 */
import "dotenv/config";
import prisma from "../src/lib/prisma.js";
import {
  assignTelemetryDevice,
  createTelemetryDevice,
  rotateTelemetryCredential,
  applyIngestedTelemetryEvent,
} from "../src/services/telemetry/telemetryPrep.js";
import { touchDeviceLastSeen } from "../src/services/telemetry/telemetryDeviceAdmin.js";

function arg(name, fallback = undefined) {
  const eqPrefix = `--${name}=`;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(eqPrefix)) return raw.slice(eqPrefix.length);
  }
  return fallback;
}

const SLUG = process.argv.includes("--slug=trans-motin")
  ? "trans-motin"
  : "abbroto";
const vehicleCount = Math.min(
  4,
  Math.max(1, Number(arg("vehicles", "1")) || 1),
);

/** IMEIs fixos por slot (evita colisão com trans-motin …222222). */
const DEMO_IMEIS = {
  abbroto: ["352094081111111", "352094083333333", "352094084444444"],
  "trans-motin": ["352094082222222", "352094085555555"],
};

const tenant = await prisma.tenants.findFirst({ where: { slug: SLUG } });
if (!tenant) {
  console.error(`Tenant ${SLUG} não encontrado`);
  process.exit(1);
}

async function ensureTruck(index) {
  const trucks = await prisma.caminhoes.findMany({
    where: { tenant_id: tenant.id },
    orderBy: { id: "asc" },
    take: index + 1,
  });
  if (trucks[index]) return trucks[index];
  return prisma.caminhoes.create({
    data: {
      tenant_id: tenant.id,
      placa: `TEL0A${String(index + 1).padStart(2, "0")}`,
      qtd_pneus: 6,
      km_atual: 120000 + index * 1000,
      tipo_veiculo: "truck",
    },
  });
}

async function ensureDevice({ index, truck }) {
  const imeis = DEMO_IMEIS[SLUG] || DEMO_IMEIS.abbroto;
  const imei = imeis[index] || `35209408${String(1000000 + index).slice(-7)}`;
  const externalId =
    index === 0 ? `demo-teltonika-${SLUG}` : `demo-teltonika-${SLUG}-${index + 1}`;
  const credential =
    index === 0
      ? `demo-device-secret-${SLUG}-ok123456`
      : `demo-device-secret-${SLUG}-v${index + 1}-ok123456`;
  const nome = index === 0 ? "Demo Teltonika" : `Demo Teltonika #${index + 1}`;

  let device = await prisma.telemetry_devices.findFirst({
    where: { tenant_id: tenant.id, external_id: externalId },
  });

  if (!device) {
    device = await createTelemetryDevice({
      tenantId: tenant.id,
      externalId,
      nome,
      credential,
      manufacturer: "Teltonika",
      model: "FMB920",
      imei,
      protocol: "teltonika",
      ownershipType: "ATRACK",
    });
  } else {
    await rotateTelemetryCredential(tenant.id, device.id, credential);
    device = await prisma.telemetry_devices.findFirst({
      where: { id: device.id },
    });
  }

  const open = await prisma.telemetry_device_assignments.findFirst({
    where: { device_id: device.id, fim_em: null },
  });
  if (!open || open.caminhao_id !== truck.id) {
    await assignTelemetryDevice({
      tenantId: tenant.id,
      deviceId: device.id,
      caminhaoId: truck.id,
    });
  }

  // Vínculo com início no passado: simulador/histórico cobrem o período sem
  // cair em “no assignment” por timestamp ligeiramente atrasado.
  await prisma.telemetry_device_assignments.updateMany({
    where: { device_id: device.id, fim_em: null },
    data: { inicio_em: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });

  await touchDeviceLastSeen(device.id);

  const latOffset = index * 0.01;
  const baseLat = -25.4284 - latOffset;
  const baseLng = -49.2733;
  const started = Date.now() - 60_000;
  for (let i = 0; i < 12; i += 1) {
    await applyIngestedTelemetryEvent({
      deviceId: device.id,
      eventId: `demo-${SLUG}-${index}-${started}-${i}`,
      recordedAt: new Date(started + i * 5_000).toISOString(),
      receivedAt: new Date().toISOString(),
      latitude: baseLat + i * 0.0012,
      longitude: baseLng + i * 0.0008,
      speedKmh: 35 + (i % 20),
      heading: (90 + i * 12) % 360,
      ignition: true,
    });
  }

  return {
    truck: { id: truck.id, placa: truck.placa },
    device: {
      id: device.id,
      external_id: device.external_id,
      imei: device.imei,
      protocol: device.protocol,
    },
    credential,
    simulateHint:
      index === 0
        ? `node scripts/teltonika-simulate.mjs --imei=${device.imei} --route=curitiba`
        : `node scripts/teltonika-simulate.mjs --imei=${device.imei} --route=curitiba-norte --odometer-start=${130000 + index * 1000}`,
  };
}

const vehicles = [];
for (let i = 0; i < vehicleCount; i += 1) {
  const truck = await ensureTruck(i);
  vehicles.push(await ensureDevice({ index: i, truck }));
}

// Demo: limite baixo + geocerca que o loop cruza (enter/exit + toast no mapa).
await prisma.telemetry_alert_rules.updateMany({
  where: { tenant_id: tenant.id, alert_type: "speed" },
  data: { config: { max_speed_kmh: 45 }, enabled: true },
});
const patio = await prisma.telemetry_geofences.findFirst({
  where: { tenant_id: tenant.id, name: "Patio Curitiba Demo" },
});
if (patio) {
  await prisma.telemetry_geofences.update({
    where: { id: patio.id },
    data: {
      enabled: true,
      geometry: {
        center: { lat: -25.4284, lng: -49.2733 },
        radius_m: 900,
      },
    },
  });
} else {
  await prisma.telemetry_geofences.create({
    data: {
      tenant_id: tenant.id,
      name: "Patio Curitiba Demo",
      shape: "circle",
      enabled: true,
      geometry: {
        center: { lat: -25.4284, lng: -49.2733 },
        radius_m: 900,
      },
    },
  });
}
await prisma.telemetry_alerts.updateMany({
  where: { tenant_id: tenant.id, status: "open", alert_type: "offline" },
  data: { status: "resolved", resolved_at: new Date() },
});

console.log(
  JSON.stringify(
    {
      tenant: { id: tenant.id, slug: tenant.slug },
      vehicles,
      demoAlerts: {
        speedLimitKmh: 45,
        geofence: "Patio Curitiba Demo (raio 900m)",
      },
      loginHint:
        SLUG === "abbroto"
          ? { email: "admin@abrotto.local", password: "admin123456" }
          : { email: "mauricio@transmotin.com", password: "(senha do cliente)" },
      urls: {
        monitoramento: "/telemetria/monitoramento",
        history: "/telemetria/historico",
        devices: "/telemetria/dispositivos",
      },
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
