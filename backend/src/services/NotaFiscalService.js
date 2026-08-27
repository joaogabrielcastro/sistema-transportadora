import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { parseNfeXml, normalizePlaca } from "../utils/parseNfeXml.js";
import { NOTAS_ROOT, notaDocsDir } from "../utils/uploadPaths.js";

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

async function resolveCaminhaoId(tx, tenantId, parsed) {
  if (parsed.caminhao_id) {
    const byId = await tx.caminhoes.findFirst({
      where: withTenant(tenantId, { id: Number(parsed.caminhao_id) }),
      select: { id: true },
    });
    if (byId) return byId.id;
  }
  const placas = [
    parsed.placa_sugerida,
    ...(Array.isArray(parsed.placas_sugeridas) ? parsed.placas_sugeridas : []),
  ]
    .map(normalizePlaca)
    .filter(Boolean);
  for (const placa of [...new Set(placas)]) {
    const all = await tx.caminhoes.findMany({
      where: { tenant_id: Number(tenantId) },
      select: { id: true, placa: true },
    });
    const hit = all.find((c) => normalizePlaca(c.placa) === placa);
    if (hit) return hit.id;
  }
  return null;
}

function unitPriceOf(item) {
  const n = Number(item?.valor_unitario);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function findOrCreateProduto(tx, tenantId, item) {
  const codigo = item.codigo?.trim() || null;
  const precoCusto = unitPriceOf(item);
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
        preco_custo: precoCusto,
      },
    });
  }

  return { produto, precoCusto };
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
              codigo: true,
              descricao: true,
              unidade: true,
              quantidade: true,
              valor_unitario: true,
              valor_total: true,
              valor_desconto: true,
              valor_ipi: true,
            },
          },
          caminhoes: {
            select: { id: true, placa: true, modelo: true, tipo_veiculo: true },
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
      include: {
        itens: {
          orderBy: { id: "asc" },
        },
        caminhoes: {
          select: {
            id: true,
            placa: true,
            modelo: true,
            marca: true,
            tipo_veiculo: true,
          },
        },
      },
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
    } else if (parsed.numero) {
      const dup = await prisma.notas_fiscais.findFirst({
        where: withTenant(tenantId, {
          numero: String(parsed.numero),
          serie: parsed.serie || null,
          ...(parsed.cnpj_emitente
            ? { cnpj_emitente: String(parsed.cnpj_emitente).replace(/\D/g, "") }
            : {}),
        }),
      });
      if (dup) {
        const err = new Error(
          `Nota ${parsed.numero}${parsed.serie ? `/${parsed.serie}` : ""} já cadastrada`,
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
      const caminhaoId = await resolveCaminhaoId(tx, tenantId, parsed);

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
          valor_desconto: parsed.valor_desconto ?? null,
          valor_frete: parsed.valor_frete ?? null,
          valor_ipi: parsed.valor_ipi ?? null,
          xml_path: files.xmlPath || null,
          pdf_path: files.pdfPath || null,
          status: "confirmada",
          origem: parsed.origem || (files.xmlPath ? "xml" : "manual"),
          observacao: parsed.observacao || null,
          data_vencimento: parsed.data_vencimento
            ? new Date(parsed.data_vencimento)
            : null,
          condicao_pagamento: parsed.condicao_pagamento || null,
          caminhao_id: caminhaoId,
        },
      });

      for (const item of itens) {
        const qtd = Number(item.quantidade);
        if (!Number.isFinite(qtd) || qtd <= 0) continue;

        const { produto, precoCusto } = await findOrCreateProduto(
          tx,
          tenantId,
          item,
        );

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
            valor_desconto: item.valor_desconto ?? null,
            valor_ipi: item.valor_ipi ?? null,
          },
        });

        await tx.produtos.update({
          where: { id: produto.id },
          data: {
            saldo: { increment: qtd },
            ...(precoCusto != null ? { preco_custo: precoCusto } : {}),
          },
        });

        await tx.estoque_movimentos.create({
          data: {
            tenant_id: Number(tenantId),
            produto_id: produto.id,
            tipo: "entrada",
            quantidade: qtd,
            nota_id: created.id,
            caminhao_id: caminhaoId,
            motivo: caminhaoId
              ? `Entrada NF ${parsed.numero} (estoque do caminhão)`
              : `Entrada NF ${parsed.numero}`,
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

  /**
   * Reabre/edita nota já lançada: atualiza cabeçalho e reconcilia itens no estoque.
   */
  static async atualizar(tenantId, notaId, parsed) {
    const id = Number(notaId);
    const itensNovos = Array.isArray(parsed.itens) ? parsed.itens : [];
    if (!itensNovos.length) {
      const err = new Error("Informe ao menos um item");
      err.statusCode = 400;
      throw err;
    }

    await prisma.$transaction(async (tx) => {
      const existente = await tx.notas_fiscais.findFirst({
        where: withTenant(tenantId, { id }),
        include: { itens: true },
      });
      if (!existente) {
        const err = new Error("Nota não encontrada");
        err.statusCode = 404;
        throw err;
      }

      const caminhaoId = await resolveCaminhaoId(tx, tenantId, {
        ...parsed,
        caminhao_id:
          parsed.caminhao_id !== undefined
            ? parsed.caminhao_id
            : existente.caminhao_id,
      });

      // Reverte entradas desta nota no estoque
      const entradas = await tx.estoque_movimentos.findMany({
        where: {
          tenant_id: Number(tenantId),
          nota_id: id,
          tipo: "entrada",
        },
      });
      for (const mov of entradas) {
        const produto = await tx.produtos.findFirst({
          where: withTenant(tenantId, { id: mov.produto_id }),
        });
        if (!produto) continue;
        const qtd = Number(mov.quantidade);
        if (Number(produto.saldo) < qtd) {
          const err = new Error(
            `Não é possível editar: o item "${produto.descricao}" já foi usado no estoque (saldo ${produto.saldo}, entrada da nota ${qtd}). Dê entrada manual ou ajuste as baixas antes.`,
          );
          err.statusCode = 400;
          throw err;
        }
        await tx.produtos.update({
          where: { id: produto.id },
          data: { saldo: { decrement: qtd } },
        });
      }
      await tx.estoque_movimentos.deleteMany({
        where: {
          tenant_id: Number(tenantId),
          nota_id: id,
          tipo: "entrada",
        },
      });
      await tx.nota_itens.deleteMany({ where: { nota_id: id } });

      await tx.notas_fiscais.update({
        where: { id },
        data: {
          chave_acesso:
            parsed.chave_acesso !== undefined
              ? parsed.chave_acesso || null
              : existente.chave_acesso,
          numero: String(parsed.numero || existente.numero),
          serie:
            parsed.serie !== undefined ? parsed.serie || null : existente.serie,
          emitente:
            parsed.emitente !== undefined
              ? parsed.emitente || null
              : existente.emitente,
          cnpj_emitente:
            parsed.cnpj_emitente !== undefined
              ? parsed.cnpj_emitente || null
              : existente.cnpj_emitente,
          data_emissao:
            parsed.data_emissao !== undefined
              ? parsed.data_emissao
                ? new Date(parsed.data_emissao)
                : null
              : existente.data_emissao,
          data_vencimento:
            parsed.data_vencimento !== undefined
              ? parsed.data_vencimento
                ? new Date(parsed.data_vencimento)
                : null
              : existente.data_vencimento,
          condicao_pagamento:
            parsed.condicao_pagamento !== undefined
              ? parsed.condicao_pagamento || null
              : existente.condicao_pagamento,
          observacao:
            parsed.observacao !== undefined
              ? parsed.observacao || null
              : existente.observacao,
          valor_total: parsed.valor_total ?? existente.valor_total,
          valor_desconto:
            parsed.valor_desconto !== undefined
              ? parsed.valor_desconto
              : existente.valor_desconto,
          valor_frete:
            parsed.valor_frete !== undefined
              ? parsed.valor_frete
              : existente.valor_frete,
          valor_ipi:
            parsed.valor_ipi !== undefined
              ? parsed.valor_ipi
              : existente.valor_ipi,
          caminhao_id: caminhaoId,
        },
      });

      for (const item of itensNovos) {
        const qtd = Number(item.quantidade);
        if (!Number.isFinite(qtd) || qtd <= 0) continue;

        const { produto, precoCusto } = await findOrCreateProduto(
          tx,
          tenantId,
          item,
        );

        await tx.nota_itens.create({
          data: {
            nota_id: id,
            produto_id: produto.id,
            codigo: item.codigo || null,
            descricao: item.descricao,
            unidade: item.unidade || "UN",
            ncm: item.ncm || null,
            quantidade: qtd,
            valor_unitario: item.valor_unitario ?? null,
            valor_total: item.valor_total ?? null,
            valor_desconto: item.valor_desconto ?? null,
            valor_ipi: item.valor_ipi ?? null,
          },
        });

        await tx.produtos.update({
          where: { id: produto.id },
          data: {
            saldo: { increment: qtd },
            ...(precoCusto != null ? { preco_custo: precoCusto } : {}),
          },
        });

        await tx.estoque_movimentos.create({
          data: {
            tenant_id: Number(tenantId),
            produto_id: produto.id,
            tipo: "entrada",
            quantidade: qtd,
            nota_id: id,
            caminhao_id: caminhaoId,
            motivo: caminhaoId
              ? `Ajuste NF ${parsed.numero || existente.numero} (estoque do caminhão)`
              : `Ajuste NF ${parsed.numero || existente.numero}`,
          },
        });
      }
    });

    return NotaFiscalService.getById(tenantId, id);
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

function signMovimento(tipo) {
  if (tipo === "entrada") return 1;
  if (tipo === "baixa") return -1;
  return 0;
}

export class EstoqueService {
  /**
   * Baixa estoque dentro de uma transação já aberta (gasto/manutenção).
   */
  static async baixarComTx(
    tx,
    tenantId,
    { produto_id, quantidade, motivo, caminhao_id },
  ) {
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      const err = new Error("Quantidade de estoque inválida");
      err.statusCode = 400;
      throw err;
    }

    const produto = await tx.produtos.findFirst({
      where: withTenant(tenantId, { id: Number(produto_id) }),
    });
    if (!produto) {
      const err = new Error("Produto não encontrado no estoque");
      err.statusCode = 404;
      throw err;
    }

    const saldo = Number(produto.saldo);
    if (saldo < qtd) {
      const err = new Error(`Saldo insuficiente (disponível: ${saldo})`);
      err.statusCode = 400;
      throw err;
    }

    await tx.produtos.update({
      where: { id: produto.id },
      data: { saldo: { decrement: qtd } },
    });

    await tx.estoque_movimentos.create({
      data: {
        tenant_id: Number(tenantId),
        produto_id: produto.id,
        tipo: "baixa",
        quantidade: qtd,
        caminhao_id: caminhao_id ? Number(caminhao_id) : null,
        motivo: motivo || "Baixa de estoque",
      },
    });

    return produto;
  }

  static async listarProdutos(
    tenantId,
    { page = 1, limit = 50, termo, caminhao_id } = {},
  ) {
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

    const serialized = serializePrisma(data);
    const produtoIds = serialized.map((p) => p.id);
    if (!produtoIds.length) {
      return { data: serialized, count };
    }

    const grouped = await prisma.estoque_movimentos.groupBy({
      by: ["produto_id", "caminhao_id", "tipo"],
      where: {
        tenant_id: Number(tenantId),
        produto_id: { in: produtoIds },
      },
      _sum: { quantidade: true },
    });

    const saldoPorDestino = new Map();
    for (const row of grouped) {
      const sign = signMovimento(row.tipo);
      const qtd = Number(row._sum?.quantidade || 0) * sign;
      if (!saldoPorDestino.has(row.produto_id)) {
        saldoPorDestino.set(row.produto_id, new Map());
      }
      const destKey = row.caminhao_id == null ? 0 : Number(row.caminhao_id);
      const destMap = saldoPorDestino.get(row.produto_id);
      destMap.set(destKey, (destMap.get(destKey) || 0) + qtd);
    }

    const caminhaoIds = [
      ...new Set(
        grouped
          .map((row) => row.caminhao_id)
          .filter((id) => id != null)
          .map(Number),
      ),
    ];
    const placas = caminhaoIds.length
      ? await prisma.caminhoes.findMany({
          where: withTenant(tenantId, { id: { in: caminhaoIds } }),
          select: { id: true, placa: true },
        })
      : [];
    const placaMap = new Map(placas.map((c) => [c.id, c.placa]));

    const cid = caminhao_id ? Number(caminhao_id) : null;
    const enriched = serialized.map((p) => {
      const destMap = saldoPorDestino.get(p.id) || new Map();
      const destinos = [];
      for (const [destId, saldoDest] of destMap.entries()) {
        if (saldoDest <= 0) continue;
        if (destId === 0) {
          destinos.push({
            caminhao_id: null,
            placa: null,
            saldo: saldoDest,
            geral: true,
          });
        } else {
          destinos.push({
            caminhao_id: destId,
            placa: placaMap.get(destId) || null,
            saldo: saldoDest,
            geral: false,
          });
        }
      }
      destinos.sort((a, b) => Number(b.saldo) - Number(a.saldo));
      const saldo_caminhao = cid ? Number(destMap.get(cid) || 0) : null;
      return { ...p, destinos, saldo_caminhao };
    });

    if (cid) {
      enriched.sort((a, b) => {
        const da = Number(a.saldo_caminhao) > 0 ? 0 : 1;
        const db = Number(b.saldo_caminhao) > 0 ? 0 : 1;
        if (da !== db) return da - db;
        return String(a.descricao || "").localeCompare(
          String(b.descricao || ""),
          "pt-BR",
        );
      });
    }

    return { data: enriched, count };
  }

  static async baixar(tenantId, { produto_id, quantidade, motivo, caminhao_id }) {
    const result = await prisma.$transaction(async (tx) => {
      await EstoqueService.baixarComTx(tx, tenantId, {
        produto_id,
        quantidade,
        motivo,
        caminhao_id,
      });
      return tx.estoque_movimentos.findFirst({
        where: withTenant(tenantId, {
          produto_id: Number(produto_id),
          tipo: "baixa",
        }),
        orderBy: { id: "desc" },
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
