#!/usr/bin/env node
/**
 * Cria um tenant + usuário admin inicial.
 *
 * Uso:
 *   node scripts/create-tenant.mjs --slug=empresa-x --nome="Empresa X" --email=admin@empresa.com --password=SenhaSegura123
 *
 * Por padrão o tenant ENTRA EM TRIAL (billing cobrado).
 * Para criar isento (legado/parceiro):
 *   ... --exempt=true
 *
 * Requer DATABASE_URL no ambiente ou em backend/.env
 */
import "dotenv/config";
import prisma from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";
import { config } from "../src/config/index.js";
import {
  exemptTenantBillingDefaults,
  newTenantBillingDefaults,
} from "../src/utils/tenantFeatures.js";

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function usage() {
  console.error(`Uso:
  node scripts/create-tenant.mjs --slug=empresa --nome="Empresa" --email=admin@empresa.com --password=SenhaSegura123

Opções:
  --slug       Identificador único (a-z, 0-9, hífen)
  --nome       Nome de exibição
  --email      E-mail do admin (único global)
  --password   Senha do admin (mín. 8 caracteres)
  --nome-admin Nome do usuário admin (opcional)
  --exempt     true = sem cobrança Stripe (padrão: false = trial)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = String(args.slug || "")
    .trim()
    .toLowerCase();
  const nome = String(args.nome || "").trim();
  const email = String(args.email || "")
    .trim()
    .toLowerCase();
  const password = String(args.password || "");
  const nomeAdmin = String(args["nome-admin"] || "Administrador").trim();
  const exempt = parseBool(args.exempt, false);

  if (!slug || !nome || !email || !password) {
    usage();
    process.exit(1);
  }

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    console.error("slug inválido: use apenas a-z, 0-9 e hífen (2–64 chars).");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("password deve ter no mínimo 8 caracteres.");
    process.exit(1);
  }

  const existingTenant = await prisma.tenants.findUnique({ where: { slug } });
  if (existingTenant) {
    console.error(`Já existe tenant com slug "${slug}".`);
    process.exit(1);
  }

  const existingUser = await prisma.users.findUnique({ where: { email } });
  if (existingUser) {
    console.error(`Já existe usuário com e-mail "${email}" (e-mail é único global).`);
    process.exit(1);
  }

  const password_hash = await hashPassword(password);
  const billing = exempt
    ? exemptTenantBillingDefaults(slug)
    : newTenantBillingDefaults(config.billing.trialDays);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenants.create({
      data: {
        nome,
        slug,
        ativo: true,
        ...billing,
      },
    });

    const user = await tx.users.create({
      data: {
        tenant_id: tenant.id,
        email,
        nome: nomeAdmin,
        role: "admin",
        password_hash,
        ativo: true,
      },
      select: { id: true, email: true, role: true, tenant_id: true },
    });

    return { tenant, user };
  });

  console.log("Tenant criado com sucesso:");
  console.log(
    JSON.stringify(
      {
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          nome: result.tenant.nome,
          billing_exempt: result.tenant.billing_exempt,
          plan: result.tenant.plan,
          subscription_status: result.tenant.subscription_status,
          trial_ends_at: result.tenant.trial_ends_at,
        },
        admin: result.user,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
