#!/usr/bin/env node
/**
 * Atualiza billing de um tenant (isentar ou ativar cobrança).
 *
 * Uso:
 *   node scripts/set-tenant-billing.mjs --slug=empresa --exempt=true
 *   node scripts/set-tenant-billing.mjs --slug=empresa --exempt=false
 *   node scripts/set-tenant-billing.mjs --slug=empresa --plan=ops
 *   node scripts/set-tenant-billing.mjs --id=3 --exempt=false --plan=complete
 */
import "dotenv/config";
import { BillingService } from "../src/services/BillingService.js";
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
  if (value === undefined) return undefined;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function usage() {
  console.error(`Uso:
  node scripts/set-tenant-billing.mjs --slug=empresa --exempt=true|false [--plan=starter|ops|fiscal|complete]
  node scripts/set-tenant-billing.mjs --id=1 --exempt=false
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug ? String(args.slug).trim().toLowerCase() : undefined;
  const id = args.id ? Number(args.id) : undefined;
  const billingExempt = parseBool(args.exempt);
  const plan = args.plan !== undefined ? String(args.plan).trim() : undefined;

  if ((!slug && !id) || (billingExempt === undefined && plan === undefined)) {
    usage();
    process.exit(1);
  }

  const data = await BillingService.adminUpdateTenantBilling({
    tenantId: Number.isInteger(id) ? id : undefined,
    slug,
    billingExempt,
    plan,
  });

  console.log("Billing atualizado:");
  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
