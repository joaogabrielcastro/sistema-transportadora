import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import {
  fiscalClienteSchema,
  fiscalClienteUpdateSchema,
} from "../../schemas/fiscalSchema.js";
import { findOwnedOr404 } from "./fiscalShared.js";

/**
 * Cliente = tomador do frete (CT-e). Não existe equivalente no ATrack
 * (notas_fiscais é fornecedor de compra). cnpj_cpf é normalizado (só dígitos)
 * pelo schema Zod antes de chegar aqui — bug conhecido no jwsoft, corrigido
 * na origem.
 */
export class FiscalClienteService {
  static async list(tenantId, { q } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (q && String(q).trim().length >= 2) {
      const term = String(q).trim();
      where.OR = [
        { razao_social: { contains: term, mode: "insensitive" } },
        { cnpj_cpf: { contains: term.replace(/\D/g, "") } },
      ];
    }
    const rows = await prisma.fiscal_clientes.findMany({
      where,
      orderBy: { razao_social: "asc" },
    });
    return serializePrisma(rows);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404(
      "fiscal_clientes",
      id,
      tenantId,
      "Cliente",
    );
    return serializePrisma(row);
  }

  static async create(tenantId, body) {
    const data = fiscalClienteSchema.parse(body);
    const row = await prisma.fiscal_clientes.create({
      data: {
        tenant_id: Number(tenantId),
        razao_social: data.razao_social,
        cnpj_cpf: data.cnpj_cpf,
      },
    });
    return serializePrisma(row);
  }

  static async update(tenantId, id, body) {
    await findOwnedOr404("fiscal_clientes", id, tenantId, "Cliente");
    const data = fiscalClienteUpdateSchema.parse(body);
    const patch = {};
    if (data.razao_social !== undefined) patch.razao_social = data.razao_social;
    if (data.cnpj_cpf !== undefined) patch.cnpj_cpf = data.cnpj_cpf;
    const row = await prisma.fiscal_clientes.update({
      where: { id: Number(id) },
      data: patch,
    });
    return serializePrisma(row);
  }

  static async remove(tenantId, id) {
    await findOwnedOr404("fiscal_clientes", id, tenantId, "Cliente");
    await prisma.fiscal_clientes.delete({ where: { id: Number(id) } });
    return { deleted: true };
  }
}
