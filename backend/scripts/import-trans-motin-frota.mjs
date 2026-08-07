#!/usr/bin/env node
/**
 * Upsert frota tipada (truck/cavalo/carreta) no tenant Trans Motin.
 *
 *   node scripts/import-trans-motin-frota.mjs --slug=trans-motin
 *   node scripts/import-trans-motin-frota.mjs --slug=trans-motin --dry-run
 *
 * Dados: scripts/data/trans-motin-frota.json
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../src/lib/prisma.js";
import { defaultFeaturesForSlug } from "../src/utils/tenantFeatures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "trans-motin-frota.json");

function parseArgs(argv) {
  const out = { dryRun: false, slug: "trans-motin" };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else {
      const m = arg.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function normalizePlaca(placa) {
  return String(placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(DATA_PATH)) {
    console.error("Arquivo não encontrado:", DATA_PATH);
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("JSON deve ser um array");
    process.exit(1);
  }

  let tenant = await prisma.tenants.findUnique({
    where: { slug: String(args.slug).toLowerCase() },
  });

  if (!tenant) {
    tenant = await prisma.tenants.findFirst({
      where: { nome: { contains: "motin", mode: "insensitive" } },
    });
  }

  if (!tenant) {
    if (args.dryRun) {
      console.log("[dry-run] Tenant trans-motin seria criado");
      tenant = { id: 0, slug: args.slug };
    } else {
      tenant = await prisma.tenants.create({
        data: {
          nome: "Trans Motin",
          slug: "trans-motin",
          ativo: true,
          features: defaultFeaturesForSlug("trans-motin"),
        },
      });
      console.log("Tenant criado:", tenant.slug, tenant.id);
    }
  } else if (!args.dryRun) {
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { features: defaultFeaturesForSlug("trans-motin") },
    });
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const placa = normalizePlaca(row.placa);
    if (!placa || placa.length < 7) {
      console.warn("Placa inválida, pulando:", row.placa);
      continue;
    }

    const data = {
      placa,
      tipo_veiculo: row.tipo_veiculo || "truck",
      marca: row.marca || null,
      modelo: row.modelo || null,
      config_eixos: row.config_eixos || null,
      com_4_eixo: Boolean(row.com_4_eixo),
      qtd_pneus: Number(row.qtd_pneus) || 6,
      km_atual: Number(row.km_atual) || 0,
      motorista:
        row.tipo_veiculo === "carreta"
          ? null
          : row.motorista || "A definir",
      chassi: row.chassi || null,
      empresa: row.empresa || null,
      ano: row.ano != null ? Number(row.ano) : null,
    };

    if (args.dryRun) {
      console.log("[dry-run]", data.tipo_veiculo, placa, data.modelo);
      continue;
    }

    const existing = await prisma.caminhoes.findUnique({
      where: {
        tenant_id_placa: { tenant_id: tenant.id, placa },
      },
    });

    if (existing) {
      await prisma.caminhoes.update({
        where: { id: existing.id },
        data: {
          tipo_veiculo: data.tipo_veiculo,
          marca: data.marca ?? existing.marca,
          modelo: data.modelo ?? existing.modelo,
          config_eixos: data.config_eixos ?? existing.config_eixos,
          com_4_eixo: data.com_4_eixo,
          qtd_pneus: data.qtd_pneus || existing.qtd_pneus,
          chassi: data.chassi ?? existing.chassi,
          empresa: data.empresa ?? existing.empresa,
          motorista: existing.motorista || data.motorista,
        },
      });
      updated += 1;
    } else {
      await prisma.caminhoes.create({
        data: { ...data, tenant_id: tenant.id },
      });
      created += 1;
    }
  }

  console.log(
    args.dryRun
      ? `Dry-run: ${rows.length} veículos`
      : `OK tenant=${tenant.slug}: criados=${created} atualizados=${updated}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
