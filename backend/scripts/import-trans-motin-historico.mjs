#!/usr/bin/env node
/**
 * Importa histórico de manutenção/lubrificação/OS da Trans Motin
 * (extraído dos PDFs Google Docs) para o tenant informado.
 *
 * Uso (local):
 *   node scripts/import-trans-motin-historico.mjs --slug=trans-motin
 *   node scripts/import-trans-motin-historico.mjs --slug=trans-motin --dry-run
 *
 * Dados: scripts/data/trans-motin-historico.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../src/lib/prisma.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "trans-motin-historico.json");

const ITEM_BY_TIPO = {
  Manutenção: "Manutenção",
  Lubrificação: "Lubrificação",
  "Ordem de Serviço": "Ordem de Serviço",
};

const WORKSHOP_HINT =
  /^(mr\s+freios|nordica|loneiro|multifer|mec[aâ]nica\s+multifer|garagem\s*33|jfc(?:\s+assistencia)?|felix\s+e\s+andrade|voltec|volmerscania|ideal\s+car|eletro\s+diesel|multimental|truck\s+performance)/i;

function parseArgs(argv) {
  const out = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else {
      const m = arg.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

function parseBrDate(raw) {
  const m = String(raw || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = Number(y) >= 70 ? `19${y}` : `20${y}`;
  const iso = `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normalizePlaca(placa) {
  return String(placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function splitOficinaObservacao(entry) {
  let oficina = entry.oficina ? String(entry.oficina).trim() : "";
  let observacao = entry.observacao ? String(entry.observacao).trim() : "";
  if (oficina) return { oficina, observacao };

  const lines = observacao.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && (WORKSHOP_HINT.test(lines[0]) || lines[0].length <= 40)) {
    const looksService = /^(trocado|feito|revisado|conserto|remo|montag|limpeza|kit|m\.?o\b)/i.test(
      lines[0],
    );
    if (!looksService) {
      oficina = lines[0];
      observacao = lines.slice(1).join("\n");
    }
  }
  return { oficina: oficina || null, observacao: observacao || null };
}

function parseVehicleHint(header = "") {
  const h = String(header);
  let marca = null;
  let modelo = null;
  if (/volvo/i.test(h)) marca = "Volvo";
  if (/scania/i.test(h)) marca = "Scania";
  if (/mercedes|mb\b/i.test(h)) marca = "Mercedes-Benz";
  if (/volks|vw\b/i.test(h)) marca = "Volkswagen";
  const fh = h.match(/\bFH\s*[\d.]+\b/i);
  if (fh) modelo = fh[0].replace(/\s+/g, " ").toUpperCase();
  const vm = h.match(/\bVM\s*[\d]+\b/i);
  if (vm) modelo = vm[0].replace(/\s+/g, " ").toUpperCase();
  return { marca, modelo };
}

async function ensureItem(nome) {
  return prisma.itens_checklist.upsert({
    where: { nome_item: nome },
    update: {},
    create: { nome_item: nome },
  });
}

async function ensureCaminhao(tenantId, placa, { kmAtual, marca, modelo }, dryRun) {
  const existing = await prisma.caminhoes.findFirst({
    where: { tenant_id: tenantId, placa },
  });
  if (existing) {
    const updates = {};
    if (kmAtual != null && (existing.km_atual == null || kmAtual > existing.km_atual)) {
      updates.km_atual = kmAtual;
    }
    if (marca && !existing.marca) updates.marca = marca;
    if (modelo && !existing.modelo) updates.modelo = modelo;
    if (!dryRun && Object.keys(updates).length) {
      return prisma.caminhoes.update({ where: { id: existing.id }, data: updates });
    }
    return existing;
  }
  if (dryRun) {
    return { id: -1, placa, tenant_id: tenantId, km_atual: kmAtual || 0 };
  }
  return prisma.caminhoes.create({
    data: {
      tenant_id: tenantId,
      placa,
      qtd_pneus: 6,
      km_atual: kmAtual || 0,
      marca: marca || null,
      modelo: modelo || null,
    },
  });
}

async function alreadyImported(tenantId, caminhaoId, itemId, data, observacao) {
  const found = await prisma.checklist.findFirst({
    where: {
      tenant_id: tenantId,
      caminhao_id: caminhaoId,
      item_id: itemId,
      data_manutencao: data,
      observacao: observacao || null,
    },
    select: { id: true },
  });
  return Boolean(found);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = String(args.slug || "trans-motin").trim().toLowerCase();
  const dryRun = Boolean(args.dryRun);

  const tenant =
    (await prisma.tenants.findUnique({ where: { slug } })) ||
    (await prisma.tenants.findFirst({
      where: { nome: { contains: "motin", mode: "insensitive" } },
    }));

  if (!tenant) {
    console.error(
      `Tenant não encontrado (slug="${slug}"). Informe --slug=... ou cadastre a empresa.`,
    );
    process.exit(1);
  }

  const docs = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  console.log(
    `Tenant: ${tenant.nome} (id=${tenant.id}, slug=${tenant.slug})${dryRun ? " [DRY-RUN]" : ""}`,
  );
  console.log(`Arquivos: ${docs.length} | Eventos brutos: ${docs.reduce((n, d) => n + d.count, 0)}`);

  const itemIds = {};
  for (const nome of Object.values(ITEM_BY_TIPO)) {
    if (dryRun) {
      itemIds[nome] = -1;
    } else {
      const item = await ensureItem(nome);
      itemIds[nome] = item.id;
      console.log(`Item checklist: ${nome} -> #${item.id}`);
    }
  }

  let created = 0;
  let skipped = 0;
  let trucks = 0;

  for (const doc of docs) {
    const placa = normalizePlaca(doc.placa);
    if (!placa) {
      console.warn(`Pulando arquivo sem placa: ${doc.arquivo}`);
      continue;
    }
    const itemNome = ITEM_BY_TIPO[doc.tipo] || "Manutenção";
    const itemId = itemIds[itemNome];
    const hint = parseVehicleHint(doc.header);
    const maxKm = doc.entries.reduce(
      (max, e) => (e.km != null && e.km > max ? e.km : max),
      0,
    );

    const caminhao = await ensureCaminhao(
      tenant.id,
      placa,
      { kmAtual: maxKm || null, marca: hint.marca, modelo: hint.modelo },
      dryRun,
    );
    trucks += 1;

    console.log(
      `\n${placa} (${doc.tipo}) — ${doc.count} eventos — max KM ${maxKm || "n/d"} — caminhão #${caminhao.id}`,
    );

    for (const entry of doc.entries) {
      const data = parseBrDate(entry.data);
      if (!data) {
        console.warn(`  data inválida: ${entry.data}`);
        skipped += 1;
        continue;
      }
      const { oficina, observacao } = splitOficinaObservacao(entry);
      if (!observacao && !oficina) {
        skipped += 1;
        continue;
      }

      if (!dryRun && caminhao.id > 0) {
        const exists = await alreadyImported(
          tenant.id,
          caminhao.id,
          itemId,
          data,
          observacao,
        );
        if (exists) {
          skipped += 1;
          continue;
        }
        await prisma.checklist.create({
          data: {
            tenant_id: tenant.id,
            caminhao_id: caminhao.id,
            item_id: itemId,
            data_manutencao: data,
            km_manutencao: entry.km ?? null,
            oficina,
            observacao,
            valor: null,
          },
        });
      }
      created += 1;
    }
  }

  console.log(`\nConcluído: ${created} manutenções ${dryRun ? "a importar" : "criadas"}, ${skipped} ignoradas, ${trucks} placas processadas.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
