import prisma from "../lib/prisma.js";
import {
  motoristaSchema,
  motoristaUpdateSchema,
} from "../schemas/motoristaSchema.js";

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export class MotoristaService {
  static async list(tenantId, { q, ativo } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (ativo === true || ativo === false) where.ativo = ativo;
    if (q && String(q).trim().length >= 2) {
      const term = String(q).trim();
      where.OR = [
        { nome: { contains: term, mode: "insensitive" } },
        { cpf: { contains: term } },
        { cnh: { contains: term } },
      ];
    }
    return prisma.motoristas.findMany({
      where,
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: {
        _count: { select: { caminhoes: true } },
      },
    });
  }

  static async getById(tenantId, id) {
    const row = await prisma.motoristas.findFirst({
      where: { id: Number(id), tenant_id: Number(tenantId) },
      include: {
        caminhoes: {
          select: { id: true, placa: true, tipo_veiculo: true },
        },
      },
    });
    if (!row) {
      const err = new Error("Motorista não encontrado");
      err.statusCode = 404;
      throw err;
    }
    return row;
  }

  static async create(tenantId, body) {
    const data = motoristaSchema.parse(body);
    return prisma.motoristas.create({
      data: {
        tenant_id: Number(tenantId),
        nome: data.nome,
        cpf: data.cpf || null,
        cnh: data.cnh || null,
        cnh_categoria: data.cnh_categoria || null,
        cnh_validade: parseDate(data.cnh_validade),
        telefone: data.telefone || null,
        whatsapp: data.whatsapp || null,
        ativo: data.ativo !== false,
        observacao: data.observacao || null,
      },
    });
  }

  static async update(tenantId, id, body) {
    await this.getById(tenantId, id);
    const data = motoristaUpdateSchema.parse(body);
    return prisma.motoristas.update({
      where: { id: Number(id) },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.cpf !== undefined ? { cpf: data.cpf || null } : {}),
        ...(data.cnh !== undefined ? { cnh: data.cnh || null } : {}),
        ...(data.cnh_categoria !== undefined
          ? { cnh_categoria: data.cnh_categoria || null }
          : {}),
        ...(data.cnh_validade !== undefined
          ? { cnh_validade: parseDate(data.cnh_validade) }
          : {}),
        ...(data.telefone !== undefined
          ? { telefone: data.telefone || null }
          : {}),
        ...(data.whatsapp !== undefined
          ? { whatsapp: data.whatsapp || null }
          : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
        ...(data.observacao !== undefined
          ? { observacao: data.observacao || null }
          : {}),
      },
    });
  }

  static async remove(tenantId, id) {
    await this.getById(tenantId, id);
    await prisma.caminhoes.updateMany({
      where: { tenant_id: Number(tenantId), motorista_id: Number(id) },
      data: { motorista_id: null },
    });
    await prisma.motoristas.delete({ where: { id: Number(id) } });
    return { deleted: true };
  }
}
