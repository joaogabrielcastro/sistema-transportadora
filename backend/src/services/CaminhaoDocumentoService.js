import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { CAMINHAO_DOCS_ROOT, caminhaoDocsDir, resolverPathNaRaiz } from "../utils/uploadPaths.js";
import { ObjectStorage } from "./ObjectStorage.js";

const MAX_DOCS_PER_CAMINHAO = 30;

const absoluteFromRel = (relPath) =>
  resolverPathNaRaiz(CAMINHAO_DOCS_ROOT, relPath);

const formatDoc = (row, arquivo_disponivel = true) => ({
  id: row.id,
  caminhao_id: row.caminhao_id,
  nome_original: row.nome_original,
  tamanho_bytes: row.tamanho_bytes,
  tipo_documento: row.tipo_documento ?? null,
  validade_em: row.validade_em ?? null,
  observacao: row.observacao ?? null,
  criado_em: row.criado_em,
  arquivo_disponivel,
});

export class CaminhaoDocumentoService {
  static async resolveCaminhao(tenantId, placa) {
    const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);
    if (!caminhao) {
      const err = new Error("Caminhão não encontrado");
      err.statusCode = 404;
      throw err;
    }
    return caminhao;
  }

  static async listar(tenantId, placa) {
    const caminhao = await this.resolveCaminhao(tenantId, placa);
    const rows = await prisma.caminhao_documentos.findMany({
      where: { caminhao_id: caminhao.id, tenant_id: Number(tenantId) },
      orderBy: { criado_em: "desc" },
    });
    const comDisponibilidade = await Promise.all(
      rows.map(async (row) => {
        const ok = await ObjectStorage.exists(row.arquivo_path, absoluteFromRel);
        return formatDoc(row, ok);
      }),
    );
    return comDisponibilidade;
  }

  static async upload(tenantId, placa, files = [], meta = {}) {
    if (!files.length) {
      const err = new Error(
        "Nenhum arquivo recebido. Envie PDFs pelo botão Adicionar PDFs (formato multipart).",
      );
      err.statusCode = 400;
      throw err;
    }

    const caminhao = await this.resolveCaminhao(tenantId, placa);
    const atual = await prisma.caminhao_documentos.count({
      where: { caminhao_id: caminhao.id, tenant_id: Number(tenantId) },
    });

    if (atual + files.length > MAX_DOCS_PER_CAMINHAO) {
      for (const f of files) {
        await fs.unlink(f.path).catch(() => {});
      }
      throw new Error(
        `Limite de ${MAX_DOCS_PER_CAMINHAO} PDFs por caminhão. Remova algum documento antes de adicionar novos.`,
      );
    }

    const validadeEm =
      meta.validade_em || meta.validadeEm
        ? new Date(meta.validade_em || meta.validadeEm)
        : null;
    const tipoDocumento = meta.tipo_documento || meta.tipoDocumento || null;
    const observacao = meta.observacao || null;

    const criados = [];
    try {
      for (const file of files) {
        const relPath = path
          .relative(CAMINHAO_DOCS_ROOT, file.path)
          .replace(/\\/g, "/");

        let storedPath = relPath;
        if (ObjectStorage.isS3Enabled()) {
          storedPath = await ObjectStorage.putFile({
            key: `caminhoes/${caminhao.id}/${path.basename(file.path)}`,
            localPath: file.path,
            contentType: "application/pdf",
          });
        }

        const row = await prisma.caminhao_documentos.create({
          data: {
            tenant_id: Number(tenantId),
            caminhao_id: caminhao.id,
            nome_original: file.originalname.slice(0, 255),
            arquivo_path: storedPath,
            tamanho_bytes: file.size,
            tipo_documento: tipoDocumento
              ? String(tipoDocumento).slice(0, 64)
              : null,
            validade_em:
              validadeEm && !Number.isNaN(validadeEm.getTime())
                ? validadeEm
                : null,
            observacao: observacao || null,
          },
        });
        criados.push(formatDoc(row));
      }
    } catch (err) {
      for (const f of files) {
        await fs.unlink(f.path).catch(() => {});
      }
      throw err;
    }

    return criados;
  }

  static async patchMeta(tenantId, placa, docId, body = {}) {
    const caminhao = await this.resolveCaminhao(tenantId, placa);
    const doc = await prisma.caminhao_documentos.findFirst({
      where: {
        id: Number(docId),
        caminhao_id: caminhao.id,
        tenant_id: Number(tenantId),
      },
    });
    if (!doc) {
      const err = new Error("Documento não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const data = {};
    if (body.tipo_documento !== undefined || body.tipoDocumento !== undefined) {
      const v = body.tipo_documento ?? body.tipoDocumento;
      data.tipo_documento = v ? String(v).slice(0, 64) : null;
    }
    if (body.validade_em !== undefined || body.validadeEm !== undefined) {
      const raw = body.validade_em ?? body.validadeEm;
      if (!raw) data.validade_em = null;
      else {
        const d = new Date(raw);
        data.validade_em = Number.isNaN(d.getTime()) ? null : d;
      }
    }
    if (body.observacao !== undefined) {
      data.observacao = body.observacao || null;
    }

    const updated = await prisma.caminhao_documentos.update({
      where: { id: doc.id },
      data,
    });
    return formatDoc(updated);
  }

  static async obterArquivo(tenantId, placa, docId) {
    const caminhao = await this.resolveCaminhao(tenantId, placa);
    const doc = await prisma.caminhao_documentos.findFirst({
      where: {
        id: Number(docId),
        caminhao_id: caminhao.id,
        tenant_id: Number(tenantId),
      },
    });

    if (!doc) {
      const err = new Error("Documento não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const stored = String(doc.arquivo_path || "");
    if (stored.startsWith("s3://")) {
      const tmpPath = path.join(
        CAMINHAO_DOCS_ROOT,
        `_tmp_${doc.id}_${Date.now()}.pdf`,
      );
      await fs.mkdir(path.dirname(tmpPath), { recursive: true });
      const absolute = await ObjectStorage.materializeToTemp(
        stored,
        absoluteFromRel,
        tmpPath,
      );
      return { doc, absolute, cleanupTemp: tmpPath };
    }

    const absolute = absoluteFromRel(doc.arquivo_path);
    try {
      await fs.access(absolute);
    } catch {
      const err = new Error(
        "Arquivo do documento não encontrado no servidor. Isso costuma ocorrer após redeploy sem volume persistente em /app/uploads — configure o volume no Coolify e envie o PDF novamente, ou remova o registro e anexe de novo.",
      );
      err.statusCode = 404;
      err.code = "DOCUMENTO_ARQUIVO_AUSENTE";
      throw err;
    }

    return { doc, absolute };
  }

  static async remover(tenantId, placa, docId) {
    const caminhao = await this.resolveCaminhao(tenantId, placa);
    const doc = await prisma.caminhao_documentos.findFirst({
      where: {
        id: Number(docId),
        caminhao_id: caminhao.id,
        tenant_id: Number(tenantId),
      },
    });

    if (!doc) {
      const err = new Error("Documento não encontrado");
      err.statusCode = 404;
      throw err;
    }

    await prisma.caminhao_documentos.delete({ where: { id: doc.id } });

    const absolute = absoluteFromRel(doc.arquivo_path);
    await fs.unlink(absolute).catch(() => {});

    const dir = caminhaoDocsDir(doc.caminhao_id);
    const restantes = await fs.readdir(dir).catch(() => []);
    if (restantes.length === 0) {
      await fs.rmdir(dir).catch(() => {});
    }

    return { id: doc.id };
  }

  static async purgeCaminhao(tenantId, caminhaoId) {
    const where = { caminhao_id: caminhaoId, tenant_id: Number(tenantId) };
    const rows = await prisma.caminhao_documentos.findMany({ where });

    await prisma.caminhao_documentos.deleteMany({ where });

    for (const row of rows) {
      const absolute = absoluteFromRel(row.arquivo_path);
      await fs.unlink(absolute).catch(() => {});
    }

    await fs.rm(caminhaoDocsDir(caminhaoId), { recursive: true, force: true }).catch(
      () => {},
    );
  }
}
