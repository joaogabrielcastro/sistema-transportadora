#!/usr/bin/env node
/**
 * Importa Despesas Gerais do SAT (CSV ;) para notas_fiscais (Notas/Estoque).
 * Agrupa por codNota; cria itens por linha (grupo). Sem movimentar estoque.
 *
 *   node scripts/import-sat-despesas-gerais.mjs --slug=trans-motin --dry-run
 *   node scripts/import-sat-despesas-gerais.mjs --slug=trans-motin --year=2026
 *   node scripts/import-sat-despesas-gerais.mjs --slug=trans-motin --delete-notas-sat
 *
 * Dados: scripts/data/sat-despesas-gerais-2026.csv
 */
import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { normalizeEmpresaFrota } from "../src/utils/empresasFrota.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(__dirname, "data", "sat-despesas-gerais-2026.csv");
const ORIGEM = "sat";

/** Supergrupo SAT → filial ATrack. */
const SUPERGRUPO_EMPRESA = {
  solofinofabrica: "Solofino",
  solofino: "Solofino",
  colombocalfirma: "Colombocal",
  colombocal: "Colombocal",
  riobranco: "Colombocal",
  frota: "Transmotin",
  // Tigre fica sem mapeamento (null)
};

function parseArgs(argv) {
  const out = {
    dryRun: false,
    deleteNotasSat: false,
    year: 2026,
    slug: "trans-motin",
    file: DEFAULT_FILE,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--delete-notas-sat") out.deleteNotasSat = true;
    else {
      const m = arg.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  if (out.file && !isAbsolute(out.file)) {
    out.file = join(process.cwd(), out.file);
  }
  if (out.year != null && out.year !== "") {
    const y = Number(out.year);
    out.year = Number.isFinite(y) ? y : 2026;
  }
  return out;
}

function parseBrDate(raw) {
  const m = String(raw || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = Number(y) >= 70 ? `19${y}` : `20${y}`;
  const iso = `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const dt = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseMoney(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function empresaFromSuperGrupo(superGrupo) {
  const key = normalizeKey(superGrupo);
  if (SUPERGRUPO_EMPRESA[key]) return SUPERGRUPO_EMPRESA[key];
  return normalizeEmpresaFrota(superGrupo);
}

async function readRows(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headers = null;
  const rows = [];
  for await (const line of rl) {
    const trimmed = line.replace(/^\uFEFF/, "").trimEnd();
    if (!trimmed) continue;
    const cols = splitCsvLine(trimmed);
    if (!headers) {
      headers = cols.map((h) => h.trim());
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function groupNotas(rows, year) {
  const map = new Map();
  let skippedYear = 0;
  let skippedBad = 0;

  for (const row of rows) {
    const data = parseBrDate(row.dataEmissao);
    const valor = parseMoney(row.valor);
    const codNota = String(row.codNota || "").trim();
    if (!data || !codNota || valor == null || valor < 0) {
      skippedBad += 1;
      continue;
    }
    if (year != null && data.getUTCFullYear() !== year) {
      skippedYear += 1;
      continue;
    }

    if (!map.has(codNota)) {
      map.set(codNota, {
        codNota,
        numero: String(row.numNota || "").trim() || codNota,
        cnpj: String(row.cnpjCpf || "").replace(/\D/g, "") || null,
        emitente: String(row.nomeForn || "").trim() || "Fornecedor SAT",
        dataEmissao: data,
        superGrupos: new Map(), // empresa candidate → valor
        itens: [],
        desconto: 0,
      });
    }
    const nota = map.get(codNota);
    // mantém a emissão mais antiga do grupo
    if (data < nota.dataEmissao) nota.dataEmissao = data;
    const desc = parseMoney(row.desconto) || 0;
    nota.desconto += desc;
    const grupo = String(row.descGrupoD || "Despesa").trim() || "Despesa";
    const superGrupo = String(row.descSuperGrupoD || "").trim();
    const emp = empresaFromSuperGrupo(superGrupo);
    if (emp) {
      nota.superGrupos.set(emp, (nota.superGrupos.get(emp) || 0) + valor);
    }
    nota.itens.push({
      descricao: `${grupo}${superGrupo ? ` (${superGrupo})` : ""}`.slice(0, 500),
      unidade: "UN",
      quantidade: 1,
      valor_unitario: Number(valor.toFixed(2)),
      valor_total: Number(valor.toFixed(2)),
      valor_desconto: desc > 0 ? Number(desc.toFixed(2)) : null,
    });
  }

  const notas = [];
  for (const nota of map.values()) {
    let empresa = null;
    let best = -1;
    for (const [emp, v] of nota.superGrupos) {
      if (v > best) {
        best = v;
        empresa = emp;
      }
    }
    const valorTotal = nota.itens.reduce((s, i) => s + Number(i.valor_total), 0);
    notas.push({
      ...nota,
      empresa,
      valorTotal: Number(valorTotal.toFixed(2)),
      desconto: Number(nota.desconto.toFixed(2)),
    });
  }

  return { notas, skippedYear, skippedBad };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.deleteNotasSat) {
    const { default: prisma } = await import("../src/lib/prisma.js");
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { slug: String(args.slug).toLowerCase() },
      });
      if (!tenant) {
        console.error(`Tenant não encontrado: ${args.slug}`);
        process.exit(1);
      }
      const where = { tenant_id: tenant.id, origem: ORIGEM };
      const count = await prisma.notas_fiscais.count({ where });
      if (args.dryRun) {
        console.log(`[dry-run] Apagaria ${count} nota(s) SAT`);
        return;
      }
      const deleted = await prisma.notas_fiscais.deleteMany({ where });
      console.log({ tenant: tenant.slug, notas_sat_apagadas: deleted.count });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
    return;
  }

  const rows = await readRows(args.file);
  console.log(`Arquivo: ${args.file}`);
  console.log(`Linhas: ${rows.length} | Ano: ${args.year}`);

  const { notas, skippedYear, skippedBad } = groupNotas(rows, args.year);
  const byEmpresa = {};
  for (const n of notas) {
    const k = n.empresa || "(sem)";
    byEmpresa[k] = (byEmpresa[k] || 0) + 1;
  }
  console.log(
    `Notas: ${notas.length} | Ignoradas: ${skippedBad} | Fora do ano: ${skippedYear}`,
  );
  console.log("Por empresa:", byEmpresa);

  if (args.dryRun) {
    console.log("[dry-run] Exemplos:");
    for (const n of notas.slice(0, 5)) {
      console.log({
        numero: n.numero,
        codNota: n.codNota,
        emitente: n.emitente,
        empresa: n.empresa,
        data: n.dataEmissao.toISOString().slice(0, 10),
        valor: n.valorTotal,
        itens: n.itens.length,
      });
    }
    console.log("[dry-run] Nenhuma gravação.");
    return;
  }

  const { default: prisma } = await import("../src/lib/prisma.js");
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { slug: String(args.slug).toLowerCase() },
    });
    if (!tenant) {
      console.error(`Tenant não encontrado: ${args.slug}`);
      process.exit(1);
    }

    let created = 0;
    let duplicated = 0;

    for (const n of notas) {
      const dup = await prisma.notas_fiscais.findFirst({
        where: {
          tenant_id: tenant.id,
          origem: ORIGEM,
          observacao: { contains: `[SAT-DG:${n.codNota}]` },
        },
        select: { id: true },
      });
      if (dup) {
        duplicated += 1;
        continue;
      }

      // também evita colisão com nota já existente mesmo número+cnpj
      const dupNum = await prisma.notas_fiscais.findFirst({
        where: {
          tenant_id: tenant.id,
          numero: String(n.numero),
          serie: "1",
          cnpj_emitente: n.cnpj,
        },
        select: { id: true },
      });
      if (dupNum) {
        duplicated += 1;
        continue;
      }

      await prisma.notas_fiscais.create({
        data: {
          tenant_id: tenant.id,
          numero: String(n.numero).slice(0, 20),
          serie: "1",
          emitente: n.emitente.slice(0, 255),
          cnpj_emitente: n.cnpj,
          data_emissao: n.dataEmissao,
          valor_total: n.valorTotal.toFixed(2),
          valor_desconto: n.desconto > 0 ? n.desconto.toFixed(2) : null,
          status: "confirmada",
          origem: ORIGEM,
          empresa: n.empresa,
          observacao: `[SAT-DG:${n.codNota}] Despesas Gerais SAT`.slice(0, 2000),
          // Sem estoque_movimentos — só histórico financeiro/nota.
          itens: {
            create: n.itens.map((item) => ({
              descricao: item.descricao,
              unidade: item.unidade,
              quantidade: item.quantidade,
              valor_unitario: item.valor_unitario,
              valor_total: item.valor_total,
              valor_desconto: item.valor_desconto,
            })),
          },
        },
      });
      created += 1;
    }

    console.log({
      tenant: tenant.slug,
      notas_created: created,
      notas_duplicated: duplicated,
    });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
