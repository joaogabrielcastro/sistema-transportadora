#!/usr/bin/env node
/**
 * Liga/desliga uma feature booleana em tenants.features (merge).
 *
 *   node scripts/set-tenant-feature.mjs --slug=empresa --feature=telemetria --on=true
 *   node scripts/set-tenant-feature.mjs --id=3 --feature=telemetria --on=false
 */
import "dotenv/config";
import prisma from "../src/lib/prisma.js";

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const ALLOWED = new Set([
  "telemetria",
  "ordem_coleta",
  "notas_estoque",
  "transporte_fiscal",
]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug ? String(args.slug).trim().toLowerCase() : undefined;
  const id = args.id ? Number(args.id) : undefined;
  const feature = String(args.feature || "").trim();
  const on = args.on !== undefined ? parseBool(args.on) : undefined;

  if ((!slug && !Number.isInteger(id)) || !ALLOWED.has(feature) || on === undefined) {
    console.error(`Uso:
  node scripts/set-tenant-feature.mjs --slug=empresa --feature=telemetria --on=true|false
  node scripts/set-tenant-feature.mjs --id=1 --feature=telemetria --on=true
Features: ${[...ALLOWED].join(", ")}`);
    process.exit(1);
  }

  const tenant = await prisma.tenants.findFirst({
    where: slug ? { slug } : { id },
  });
  if (!tenant) {
    console.error("Tenant não encontrado.");
    process.exit(1);
  }

  const current =
    tenant.features && typeof tenant.features === "object" && !Array.isArray(tenant.features)
      ? { ...tenant.features }
      : {};
  current[feature] = on;

  const updated = await prisma.tenants.update({
    where: { id: tenant.id },
    data: { features: current },
    select: { id: true, slug: true, features: true, billing_exempt: true, plan: true },
  });

  console.log(JSON.stringify(updated, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
