import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { caminhoesModel } from "../models/caminhoesModel.js";
import { CAMINHAO_DOCS_ROOT, caminhaoDocsDir } from "../utils/uploadPaths.js";

const MAX_DOCS_PER_CAMINHAO = 30;

const formatDoc = (row) => ({
  id: row.id,
  caminhao_id: row.caminhao_id,
  nome_original: row.nome_original,
  tamanho_bytes: row.tamanho_bytes,
  criado_em: row.criado_em,
});

export class CaminhaoDocumentoService {
  static async resolveCaminhao(placa) {
    const caminhao = await caminhoesModel.getByPlaca(placa);
    if (!caminhao) {
      const err = new Error("Caminhão não encontrado");
      err.statusCode = 404;
      throw err;
    }
    return caminhao;
  }

  static async listar(placa) {
    const caminhao = await this.resolveCaminhao(placa);
    const rows = await prisma.caminhao_documentos.findMany({
      where: { caminhao_id: caminhao.id },
      orderBy: { criado_em: "desc" },
    });
    return rows.map(formatDoc);
  }

  static async upload(placa, files = []) {
    if (!files.length) {
      const err = new Error(
        "Nenhum arquivo recebido. Envie PDFs pelo botão Adicionar PDFs (formato multipart).",
      );
      err.statusCode = 400;
      throw err;
    }

    const caminhao = await this.resolveCaminhao(placa);
    const atual = await prisma.caminhao_documentos.count({
      where: { caminhao_id: caminhao.id },
    });

    if (atual + files.length > MAX_DOCS_PER_CAMINHAO) {
      for (const f of files) {
        await fs.unlink(f.path).catch(() => {});
      }
      throw new Error(
        `Limite de ${MAX_DOCS_PER_CAMINHAO} PDFs por caminhão. Remova algum documento antes de adicionar novos.`,
      );
    }

    const criados = [];
    try {
      for (const file of files) {
        const relPath = path
          .relative(CAMINHAO_DOCS_ROOT, file.path)
          .replace(/\\/g, "/");

        const row = await prisma.caminhao_documentos.create({
          data: {
            caminhao_id: caminhao.id,
            nome_original: file.originalname.slice(0, 255),
            arquivo_path: relPath,
            tamanho_bytes: file.size,
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

  static async obterArquivo(placa, docId) {
    const caminhao = await this.resolveCaminhao(placa);
    const doc = await prisma.caminhao_documentos.findFirst({
      where: { id: Number(docId), caminhao_id: caminhao.id },
    });

    if (!doc) {
      const err = new Error("Documento não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const absolute = path.join(CAMINHAO_DOCS_ROOT, doc.arquivo_path);
    try {
      await fs.access(absolute);
    } catch {
      const err = new Error("Arquivo do documento não encontrado no servidor");
      err.statusCode = 404;
      throw err;
    }

    return { doc, absolute };
  }

  static async remover(placa, docId) {
    const { doc, absolute } = await this.obterArquivo(placa, docId);
    await prisma.caminhao_documentos.delete({ where: { id: doc.id } });
    await fs.unlink(absolute).catch(() => {});

    const dir = caminhaoDocsDir(doc.caminhao_id);
    const restantes = await fs.readdir(dir).catch(() => []);
    if (restantes.length === 0) {
      await fs.rmdir(dir).catch(() => {});
    }

    return { id: doc.id };
  }

  static async purgeCaminhao(caminhaoId) {
    const rows = await prisma.caminhao_documentos.findMany({
      where: { caminhao_id: caminhaoId },
    });

    await prisma.caminhao_documentos.deleteMany({
      where: { caminhao_id: caminhaoId },
    });

    for (const row of rows) {
      const absolute = path.join(CAMINHAO_DOCS_ROOT, row.arquivo_path);
      await fs.unlink(absolute).catch(() => {});
    }

    await fs.rm(caminhaoDocsDir(caminhaoId), { recursive: true, force: true }).catch(
      () => {},
    );
  }
}
