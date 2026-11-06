#!/usr/bin/env node
/**
 * Importa Contas a Pagar do SAT (CSV/TXT ;) para:
 *   - gastos (tipo Peças)
 *   - notas_fiscais (Notas/Estoque), sem movimentar estoque
 *
 *   node scripts/import-sat-contas-pagar.mjs --slug=trans-motin --dry-run
 *   node scripts/import-sat-contas-pagar.mjs --slug=trans-motin --skip-gastos
 *   node scripts/import-sat-contas-pagar.mjs --slug=trans-motin --delete-gastos-sat
 *
 * Padrão de dados: scripts/data/sat-contas-pagar.txt
 */
import "dotenv/config";
import { createReadStream, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { sanitizeGastoDetalhes } from "../src/utils/gastoDetalhes.js";
import { normalizeEmpresaFrota } from "../src/utils/empresasFrota.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(__dirname, "data", "sat-contas-pagar.txt");
const TIPO_NOME = "Peças";
const ORIGEM = "sat-contas-pagar";

const PLACA_RE =
  /PLACA[:\s\/]*([A-Z]{3}[\s\-]?[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}[\s\-]?[0-9]{4})/i;

function parseArgs(argv) {
  const out = {
    dryRun: false,
    skipGastos: false,
    skipNotas: false,
    deleteGastosSat: false,
    slug: "trans-motin",
    file: DEFAULT_FILE,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--skip-gastos") out.skipGastos = true;
    else if (arg === "--skip-notas") out.skipNotas = true;
    else if (arg === "--delete-gastos-sat") out.deleteGastosSat = true;
    else {
      const m = arg.match(/^--([^=]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  }
  if (out.file && !isAbsolute(out.file)) {
    out.file = join(process.cwd(), out.file);
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

function parseBrMoney(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizePlaca(placa) {
  return String(placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Corrige acentos quebrados típicos do export SAT (ex.: RODOVIÃRIOS). */
function fixText(value) {
  const s = String(value || "");
  if (!s) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (fixed.includes("\uFFFD")) return s;
    return /[ÁÉÍÓÚÃÕÇáéíóúãõç]/.test(fixed) ? fixed : s;
  } catch {
    return s;
  }
}

function extractPlaca(row) {
  const direct = normalizePlaca(row.placaVeiculo);
  if (direct.length >= 7) return direct;
  const obs = String(row.obs || "");
  const m = obs.match(PLACA_RE);
  if (!m) return null;
  const p = normalizePlaca(m[1]);
  return p.length >= 7 ? p : null;
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

async function readSatRows(filePath) {
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

function buildChave(row) {
  const dup = String(row.codDuplicataPagar || "").trim();
  if (dup) return `SAT-CP:${dup}`;
  const nota = String(row.numNota || "").trim();
  const serie = String(row.serie || "").trim() || "1";
  const parc = String(row.parcela || "").trim() || "1";
  const cnpj = String(row.cnpjCpfForn || "").replace(/\D/g, "");
  return `SAT-CP:${nota}-${serie}-${parc}-${cnpj}`;
}

function buildDescricao(row) {
  const nota = String(row.numNota || "").trim() || "?";
  const serie = String(row.serie || "").trim() || "1";
  const parc = String(row.parcela || "").trim();
  const forn = fixText(String(row.nomeForn || "").trim()) || "Fornecedor";
  const parcPart = parc && parc !== "1" ? ` p${parc}` : "";
  return `NF ${nota}/${serie}${parcPart} — ${forn}`.slice(0, 500);
}

function empresaFromRow(row) {
  return (
    normalizeEmpresaFrota(fixText(row.nomeFilial)) ||
    normalizeEmpresaFrota(fixText(row.nomeEmpresas)) ||
    null
  );
}

/** Número único na nota (parcelas > 1 viram sufixo -P2). */
function numeroNota(row) {
  const num = String(row.numNota || "").trim();
  const parc = String(row.parcela || "").trim();
  if (!num) return null;
  if (parc && parc !== "1") return `${num}-P${parc}`;
  return num;
}

function obsNota(row, chave) {
  const parts = [
    `[SAT ${chave}]`,
    fixText(String(row.obs || "").trim()),
  ].filter(Boolean);
  return parts.join(" ").slice(0, 2000) || null;
}

function buildDetalhes(row, chave) {
  return sanitizeGastoDetalhes({
    origem: ORIGEM,
    chave,
    num_nota: String(row.numNota || "").trim(),
    serie: String(row.serie || "").trim(),
    parcela: String(row.parcela || "").trim(),
    fornecedor: fixText(String(row.nomeForn || "").trim()),
    cnpj: String(row.cnpjCpfForn || "").replace(/\D/g, ""),
    obs: fixText(String(row.obs || "").trim()),
  });
}

async function ensureTipoPecas(prisma) {
  const existing = await prisma.tipos_gastos.findFirst({
    where: { nome_tipo: { equals: TIPO_NOME, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.tipos_gastos.create({ data: { nome_tipo: TIPO_NOME } });
}

async function deleteGastosSat(prisma, tenant, dryRun) {
  const where = {
    tenant_id: tenant.id,
    detalhes: { path: ["origem"], equals: ORIGEM },
  };
  const count = await prisma.gastos.count({ where });
  if (dryRun) {
    console.log(`[dry-run] Apagaria ${count} gasto(s) SAT do tenant ${tenant.slug}`);
    return { deleted: 0, would_delete: count };
  }
  const deleted = await prisma.gastos.deleteMany({ where });
  console.log({
    tenant: tenant.slug,
    gastos_sat_apagados: deleted.count,
  });
  return { deleted: deleted.count };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.deleteGastosSat) {
    const { default: prisma } = await import("../src/lib/prisma.js");
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { slug: String(args.slug).toLowerCase() },
      });
      if (!tenant) {
        console.error(`Tenant não encontrado: ${args.slug}`);
        process.exit(1);
      }
      await deleteGastosSat(prisma, tenant, args.dryRun);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
    return;
  }

  const rows = await readSatRows(args.file);
  console.log(`Arquivo: ${args.file}`);
  console.log(`Linhas lidas: ${rows.length}`);

  const parsed = [];
  let skipped = 0;
  for (const row of rows) {
    const dataGasto = parseBrDate(row.dataEmissao);
    const valor = parseBrMoney(row.valorVenc);
    if (!dataGasto || valor == null || valor <= 0) {
      skipped += 1;
      continue;
    }
    const valorPagto = parseBrMoney(row.valorPagto) || 0;
    const chave = buildChave(row);
    parsed.push({
      row,
      dataGasto,
      dataVenc: parseBrDate(row.dataVenc),
      valor,
      status: valorPagto > 0 ? "pago" : "pendente",
      placa: extractPlaca(row),
      chave,
      empresa: empresaFromRow(row),
      descricao: buildDescricao(row),
      detalhes: buildDetalhes(row, chave),
    });
  }

  console.log(`Válidas: ${parsed.length} | Ignoradas: ${skipped}`);
  const byEmpresa = {};
  for (const p of parsed) {
    const f = p.empresa || "(sem)";
    byEmpresa[f] = (byEmpresa[f] || 0) + 1;
  }
  console.log("Por empresa:", byEmpresa);

  if (args.dryRun) {
    console.log("[dry-run] Exemplos:");
    for (const p of parsed.slice(0, 5)) {
      console.log({
        descricao: p.descricao,
        empresa: p.empresa,
        valor: p.valor,
        data: p.dataGasto.toISOString().slice(0, 10),
        venc: p.dataVenc?.toISOString().slice(0, 10) || null,
        status: p.status,
        placa: p.placa,
        chave: p.chave,
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

    const tipo = args.skipGastos ? null : await ensureTipoPecas(prisma);
    const caminhoes = await prisma.caminhoes.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, placa: true },
    });
    const placaToId = new Map(
      caminhoes.map((c) => [normalizePlaca(c.placa), c.id]),
    );

    const resultado = {
      tenant: tenant.slug,
      gastos_created: 0,
      gastos_duplicated: 0,
      notas_created: 0,
      notas_duplicated: 0,
      sem_caminhao: 0,
    };

    let chavesGastoOk = new Set();
    if (!args.skipGastos) {
      const existentes = await prisma.gastos.findMany({
        where: {
          tenant_id: tenant.id,
          detalhes: { path: ["origem"], equals: ORIGEM },
        },
        select: { id: true, detalhes: true },
      });
      chavesGastoOk = new Set(
        existentes
          .map((g) =>
            g.detalhes && typeof g.detalhes === "object"
              ? g.detalhes.chave
              : null,
          )
          .filter(Boolean),
      );
    }

    for (const p of parsed) {
      let caminhaoId = null;
      if (p.placa && placaToId.has(p.placa)) {
        caminhaoId = placaToId.get(p.placa);
      } else {
        resultado.sem_caminhao += 1;
      }

      if (!args.skipGastos) {
        if (chavesGastoOk.has(p.chave)) {
          resultado.gastos_duplicated += 1;
        } else {
          await prisma.gastos.create({
            data: {
              tenant_id: tenant.id,
              caminhao_id: caminhaoId,
              tipo_gasto_id: tipo.id,
              data_gasto: p.dataGasto,
              data_vencimento: p.dataVenc,
              valor: p.valor.toFixed(2),
              descricao: p.descricao,
              status_pagamento: p.status,
              empresa: p.empresa,
              detalhes: p.detalhes,
            },
          });
          chavesGastoOk.add(p.chave);
          resultado.gastos_created += 1;
        }
      }

      if (!args.skipNotas) {
        const numero = numeroNota(p.row);
        const serie = String(p.row.serie || "").trim() || "1";
        const cnpj = String(p.row.cnpjCpfForn || "").replace(/\D/g, "") || null;
        if (!numero) {
          resultado.notas_duplicated += 1;
          continue;
        }

        const dup = await prisma.notas_fiscais.findFirst({
          where: {
            tenant_id: tenant.id,
            numero,
            serie,
            cnpj_emitente: cnpj,
          },
          select: { id: true },
        });
        if (dup) {
          resultado.notas_duplicated += 1;
          continue;
        }

        const emitente =
          fixText(String(p.row.nomeForn || "").trim()) || "Fornecedor SAT";
        const valor = p.valor.toFixed(2);

        await prisma.notas_fiscais.create({
          data: {
            tenant_id: tenant.id,
            numero,
            serie,
            emitente,
            cnpj_emitente: cnpj,
            data_emissao: p.dataGasto,
            data_vencimento: p.dataVenc,
            valor_total: valor,
            status: "confirmada",
            origem: "sat",
            observacao: obsNota(p.row, p.chave),
            empresa: p.empresa,
            caminhao_id: caminhaoId,
            // Sem estoque_movimentos: título a pagar, não entrada de peças.
            itens: {
              create: {
                descricao: `Título a pagar (SAT) — ${emitente}`.slice(0, 500),
                unidade: "UN",
                quantidade: 1,
                valor_unitario: valor,
                valor_total: valor,
              },
            },
          },
        });
        resultado.notas_created += 1;
      }
    }

    console.log(resultado);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
