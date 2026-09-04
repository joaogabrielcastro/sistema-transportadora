import fs from "node:fs/promises";
import prisma from "../../lib/prisma.js";
import { UPLOADS_ROOT, resolverPathNaRaiz } from "../../utils/uploadPaths.js";
import { findOwnedOr404 } from "./fiscalShared.js";

/**
 * Download de arquivos de CT-e/MDF-e já autorizados (XML/PDF), individual e em
 * lote (zip). SÓ ADICIONA comportamento — nenhuma emissão/cancelamento existente
 * é tocado. O caminho do arquivo é montado SEMPRE a partir do valor gravado em
 * `*.xml_path` / `*.pdf_path` (relativo a UPLOADS_ROOT, mesmo padrão das notas
 * de compra); nunca a partir de nada vindo do cliente.
 */

/** Teto de segurança do download em lote (evita zip gigante / I/O excessivo). */
export const LIMITE_DOWNLOAD_LOTE = 300;

const TIPOS = {
  cte: { model: "fiscal_ctes", label: "CT-e" },
  mdfe: { model: "fiscal_mdfes", label: "MDF-e" },
};

const CONTENT_TYPE = { pdf: "application/pdf", xml: "application/xml" };

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Converte o caminho RELATIVO gravado em `*.xml_path` / `*.pdf_path`
 * (ex.: `fiscal/cte/12/<chave>.pdf`) no caminho absoluto sob UPLOADS_ROOT,
 * garantindo que o resultado não escape da raiz de uploads — defesa em
 * profundidade caso algum valor estranho tenha sido persistido. Nunca recebe
 * caminho do cliente.
 */
export function resolverCaminhoAbsoluto(relPath) {
  try {
    return resolverPathNaRaiz(
      UPLOADS_ROOT,
      relPath,
      "Arquivo do documento fiscal não encontrado.",
    );
  } catch (err) {
    if (err?.statusCode === 404) {
      throw httpError(404, err.message);
    }
    throw err;
  }
}

/** Ids do corpo -> inteiros positivos, únicos, na ordem recebida. */
export function normalizarIdsLote(ids) {
  const vistos = new Set();
  const out = [];
  for (const bruto of Array.isArray(ids) ? ids : []) {
    const n = Number(bruto);
    if (!Number.isInteger(n) || n <= 0 || vistos.has(n)) continue;
    vistos.add(n);
    out.push(n);
  }
  return out;
}

/** Nome do arquivo (individual e dentro do zip): `<chave>.<ext>` com fallback. */
export function nomeArquivoDoc(doc, ext) {
  const chave = String(doc?.chave_acesso || "").replace(/[^0-9A-Za-z_-]/g, "");
  const base = chave || `documento-${doc?.id ?? "sem-id"}`;
  return `${base}.${ext === "pdf" ? "pdf" : "xml"}`;
}

function rotuloDoc(doc) {
  return [doc?.numero, doc?.serie].filter(Boolean).join("/") || `id ${doc?.id}`;
}

export class FiscalDownloadService {
  /**
   * Resolve um único arquivo (`pdf`|`xml`) de um CT-e/MDF-e do tenant. Confirma a
   * posse com `findOwnedOr404` ANTES de tocar em `pdf_path`/`xml_path`. Responde
   * 404 com mensagem clara — sem deixar `res.sendFile` estourar — quando o
   * caminho ainda não foi gravado ou o arquivo sumiu do disco.
   */
  static async obterArquivo(tipo, tenantId, id, formato) {
    const cfg = TIPOS[tipo];
    if (!cfg) throw httpError(404, "Tipo de documento fiscal inválido.");
    if (formato !== "pdf" && formato !== "xml") {
      throw httpError(404, "Formato de arquivo inválido.");
    }
    const doc = await findOwnedOr404(cfg.model, id, tenantId, cfg.label);
    const rel = formato === "pdf" ? doc.pdf_path : doc.xml_path;
    if (!rel) {
      throw httpError(
        404,
        `O ${formato.toUpperCase()} deste ${cfg.label} ainda não está disponível — o arquivo não foi gravado após a emissão.`,
      );
    }
    const absoluto = resolverCaminhoAbsoluto(rel);
    try {
      await fs.access(absoluto);
    } catch {
      throw httpError(
        404,
        `O arquivo ${formato.toUpperCase()} deste ${cfg.label} não foi encontrado no servidor.`,
      );
    }
    return {
      absoluto,
      contentType: CONTENT_TYPE[formato],
      downloadName: nomeArquivoDoc(doc, formato),
    };
  }

  /**
   * Para o download em lote: aplica o teto, filtra SÓ os ids do tenant (os
   * demais são ignorados silenciosamente, não geram erro) e devolve, para cada
   * documento, os caminhos absolutos de PDF/XML que existem em disco + a lista
   * de arquivos pulados (para o `manifest.txt` do zip).
   */
  static async coletarArquivosLote(tipo, tenantId, ids) {
    const cfg = TIPOS[tipo];
    if (!cfg) throw httpError(404, "Tipo de documento fiscal inválido.");
    const idsNorm = normalizarIdsLote(ids);
    if (idsNorm.length === 0) {
      throw httpError(400, "Informe ao menos um documento para baixar.");
    }
    if (idsNorm.length > LIMITE_DOWNLOAD_LOTE) {
      throw httpError(
        400,
        `O download em lote aceita no máximo ${LIMITE_DOWNLOAD_LOTE} documentos por vez — refine o filtro e tente de novo.`,
      );
    }

    const docs = await prisma[cfg.model].findMany({
      where: { id: { in: idsNorm }, tenant_id: Number(tenantId) },
      select: {
        id: true,
        chave_acesso: true,
        numero: true,
        serie: true,
        pdf_path: true,
        xml_path: true,
      },
    });
    if (docs.length === 0) {
      throw httpError(
        404,
        `Nenhum ${cfg.label} encontrado para os documentos selecionados.`,
      );
    }

    const porId = new Map(docs.map((d) => [d.id, d]));
    const ignorados = idsNorm.filter((id) => !porId.has(id));
    const entradas = [];
    const pulados = [];

    for (const id of idsNorm) {
      const doc = porId.get(id);
      if (!doc) continue;
      for (const formato of ["pdf", "xml"]) {
        const rel = formato === "pdf" ? doc.pdf_path : doc.xml_path;
        if (!rel) {
          pulados.push(
            `${cfg.label} ${rotuloDoc(doc)}: ${formato.toUpperCase()} não gravado`,
          );
          continue;
        }
        let absoluto;
        try {
          absoluto = resolverCaminhoAbsoluto(rel);
          await fs.access(absoluto);
        } catch {
          pulados.push(
            `${cfg.label} ${rotuloDoc(doc)}: arquivo ${formato.toUpperCase()} ausente no servidor`,
          );
          continue;
        }
        entradas.push({ nome: nomeArquivoDoc(doc, formato), absoluto });
      }
    }

    return { label: cfg.label, entradas, pulados, ignorados, total: docs.length };
  }

  /** Texto do `manifest.txt` embutido no zip quando há arquivos pulados/ignorados. */
  static montarManifest({ label, pulados = [], ignorados = [] }) {
    const linhas = [
      `Download em lote de ${label} — ${new Date().toISOString()}`,
      "",
    ];
    if (pulados.length > 0) {
      linhas.push("Arquivos NAO incluidos no zip:");
      for (const p of pulados) linhas.push(`  - ${p}`);
      linhas.push("");
    }
    if (ignorados.length > 0) {
      linhas.push(
        `Ids ignorados (nao pertencem a este tenant ou nao existem): ${ignorados.join(", ")}`,
      );
      linhas.push("");
    }
    return linhas.join("\n");
  }
}
