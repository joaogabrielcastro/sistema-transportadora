import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { parseNfeXml } from "../utils/parseNfeXml.js";
import { NOTAS_ROOT, notaDocsDir } from "../utils/uploadPaths.js";

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

async function findOrCreateProduto(tx, tenantId, item) {
  const codigo = item.codigo?.trim() || null;
  let produto = null;

  if (codigo) {
    produto = await tx.produtos.findFirst({
      where: withTenant(tenantId, { codigo }),
    });
  }

  if (!produto) {
    produto = await tx.produtos.findFirst({
      where: withTenant(tenantId, {
        descricao: { equals: item.descricao, mode: "insensitive" },
      }),
    });
  }

  if (!produto) {
    produto = await tx.produtos.create({
      data: {
        tenant_id: Number(tenantId),
        codigo,
        descricao: item.descricao,
        unidade: item.unidade || "UN",
        ncm: item.ncm,
        saldo: 0,
      },
    });
  }

  return produto;
}

export class NotaFiscalService {
  static async previewFromXml(xmlContent) {
    return parseNfeXml(xmlContent);
  }

  static async listar(tenantId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const where = withTenant(tenantId);
    const [data, count] = await prisma.$transaction([
      prisma.notas_fiscais.findMany({
        where,
        orderBy: { criado_em: "desc" },
        skip,
        take: limit,
        include: {
          itens: {
            select: {
              id: true,
              descricao: true,
              quantidade: true,
              valor_total: true,
            },
          },
        },
      }),
      prisma.notas_fiscais.count({ where }),
    ]);
    return { data: serializePrisma(data), count };
  }

  static async getById(tenantId, id) {
    const nota = await prisma.notas_fiscais.findFirst({
      where: withTenant(tenantId, { id: Number(id) }),
      include: { itens: true },
    });
    if (!nota) {
      const err = new Error("Nota não encontrada");
      err.statusCode = 404;
      throw err;
    }
    return serializePrisma(nota);
  }

  /**
   * Confirma importação: grava nota, itens, produtos e movimentos de entrada.
   * @param {object} parsed - saída de parseNfeXml (possivelmente editada)
   * @param {{ xmlPath?: string, pdfPath?: string }} files
   */
  static async confirmarImportacao(tenantId, parsed, files = {}) {
    if (parsed.chave_acesso) {
      const dup = await prisma.notas_fiscais.findFirst({
        where: withTenant(tenantId, { chave_acesso: parsed.chave_acesso }),
      });
      if (dup) {
        const err = new Error(
          `NF-e já importada (chave ${parsed.chave_acesso})`,
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const itens = Array.isArray(parsed.itens) ? parsed.itens : [];
    if (!itens.length) {
      const err = new Error("Informe ao menos um item");
      err.statusCode = 400;
      throw err;
    }

    const nota = await prisma.$transaction(async (tx) => {
      const created = await tx.notas_fiscais.create({
        data: {
          tenant_id: Number(tenantId),
          chave_acesso: parsed.chave_acesso || null,
          numero: String(parsed.numero),
          serie: parsed.serie || null,
          emitente: parsed.emitente || null,
          cnpj_emitente: parsed.cnpj_emitente || null,
          data_emissao: parsed.data_emissao
            ? new Date(parsed.data_emissao)
            : null,
          valor_total: parsed.valor_total ?? null,
          xml_path: files.xmlPath || null,
          pdf_path: files.pdfPath || null,
          status: "confirmada",
        },
      });

      for (const item of itens) {
        const qtd = Number(item.quantidade);
        if (!Number.isFinite(qtd) || qtd <= 0) continue;

        const produto = await findOrCreateProduto(tx, tenantId, item);

        await tx.nota_itens.create({
          data: {
            nota_id: created.id,
            produto_id: produto.id,
            codigo: item.codigo || null,
            descricao: item.descricao,
            unidade: item.unidade || "UN",
            ncm: item.ncm || null,
            quantidade: qtd,
            valor_unitario: item.valor_unitario ?? null,
            valor_total: item.valor_total ?? null,
          },
        });

        await tx.produtos.update({
          where: { id: produto.id },
          data: { saldo: { increment: qtd } },
        });

        await tx.estoque_movimentos.create({
          data: {
            tenant_id: Number(tenantId),
            produto_id: produto.id,
            tipo: "entrada",
            quantidade: qtd,
            nota_id: created.id,
            motivo: `Entrada NF ${parsed.numero}`,
          },
        });
      }

      return tx.notas_fiscais.findUnique({
        where: { id: created.id },
        include: { itens: true },
      });
    });

    return serializePrisma(nota);
  }

  static async salvarArquivos(tenantId, notaId, { xmlBuffer, xmlName, pdfBuffer, pdfName }) {
    const dir = notaDocsDir(tenantId, notaId);
    await fs.mkdir(dir, { recursive: true });
    const updates = {};

    if (xmlBuffer) {
      const rel = path
        .join(String(tenantId), String(notaId), xmlName || "nfe.xml")
        .replace(/\\/g, "/");
      await fs.writeFile(path.join(NOTAS_ROOT, rel), xmlBuffer);
      updates.xml_path = rel;
    }
    if (pdfBuffer) {
      const rel = path
        .join(String(tenantId), String(notaId), pdfName || "danfe.pdf")
        .replace(/\\/g, "/");
      await fs.writeFile(path.join(NOTAS_ROOT, rel), pdfBuffer);
      updates.pdf_path = rel;
    }

    if (Object.keys(updates).length) {
      await prisma.notas_fiscais.update({
        where: { id: Number(notaId) },
        data: updates,
      });
    }

    return updates;
  }
}

export class EstoqueService {
  static async listarProdutos(tenantId, { page = 1, limit = 50, termo } = {}) {
    const where = withTenant(tenantId);
    if (termo?.trim()) {
      where.OR = [
        { descricao: { contains: termo.trim(), mode: "insensitive" } },
        { codigo: { contains: termo.trim(), mode: "insensitive" } },
      ];
    }

    const [data, count] = await prisma.$transaction([
      prisma.produtos.findMany({
        where,
        orderBy: { descricao: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.produtos.count({ where }),
    ]);

    return { data: serializePrisma(data), count };
  }

  static async baixar(tenantId, { produto_id, quantidade, motivo, caminhao_id }) {
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      const err = new Error("Quantidade inválida");
      err.statusCode = 400;
      throw err;
    }

    const result = await prisma.$transaction(async (tx) => {
      const produto = await tx.produtos.findFirst({
        where: withTenant(tenantId, { id: Number(produto_id) }),
      });
      if (!produto) {
        const err = new Error("Produto não encontrado");
        err.statusCode = 404;
        throw err;
      }

      const saldo = Number(produto.saldo);
      if (saldo < qtd) {
        const err = new Error(
          `Saldo insuficiente (disponível: ${saldo})`,
        );
        err.statusCode = 400;
        throw err;
      }

      await tx.produtos.update({
        where: { id: produto.id },
        data: { saldo: { decrement: qtd } },
      });

      return tx.estoque_movimentos.create({
        data: {
          tenant_id: Number(tenantId),
          produto_id: produto.id,
          tipo: "baixa",
          quantidade: qtd,
          caminhao_id: caminhao_id ? Number(caminhao_id) : null,
          motivo: motivo || "Baixa de estoque",
        },
      });
    });

    return serializePrisma(result);
  }

  static async listarMovimentos(tenantId, { produto_id, page = 1, limit = 30 } = {}) {
    const where = withTenant(tenantId);
    if (produto_id) where.produto_id = Number(produto_id);

    const [data, count] = await prisma.$transaction([
      prisma.estoque_movimentos.findMany({
        where,
        orderBy: { criado_em: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          produtos: { select: { id: true, descricao: true, codigo: true } },
        },
      }),
      prisma.estoque_movimentos.count({ where }),
    ]);

    return { data: serializePrisma(data), count };
  }
}
