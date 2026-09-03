import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { MAX_LIST_LIMIT } from "../utils/listLimits.js";
import {
  deleteOneInTenant,
  updateOneInTenant,
} from "../utils/tenantWrite.js";

const checklistInclude = {
  caminhoes: {
    select: {
      placa: true,
    },
  },
  itens_checklist: {
    select: {
      nome_item: true,
    },
  },
};

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

export const checklistModel = {
  create: async (tenantId, checklistData) => {
    const data = await prisma.checklist.create({
      data: {
        ...checklistData,
        tenant_id: Number(tenantId),
      },
      include: checklistInclude,
    });

    return serializePrisma(data);
  },

  getAll: async (tenantId, { page = 1, limit = 10, caminhaoId = null }) => {
    const skip = (page - 1) * limit;
    const where = withTenant(
      tenantId,
      caminhaoId ? { caminhao_id: parseId(caminhaoId) } : {},
    );

    const [data, count] = await prisma.$transaction([
      prisma.checklist.findMany({
        where,
        include: checklistInclude,
        orderBy: { data_manutencao: "desc" },
        skip,
        take: limit,
      }),
      prisma.checklist.count({ where }),
    ]);

    return { data: serializePrisma(data), count };
  },

  getById: async (tenantId, id) => {
    const data = await prisma.checklist.findFirst({
      where: withTenant(tenantId, { id: parseId(id) }),
      include: checklistInclude,
    });

    return serializePrisma(data);
  },

  getByCaminhaoId: async (tenantId, caminhaoId, { limit = MAX_LIST_LIMIT } = {}) => {
    const where = withTenant(tenantId, { caminhao_id: parseId(caminhaoId) });

    const [data, total] = await prisma.$transaction([
      prisma.checklist.findMany({
        where,
        include: {
          itens_checklist: {
            select: {
              nome_item: true,
            },
          },
        },
        orderBy: { data_manutencao: "desc" },
        take: limit,
      }),
      prisma.checklist.count({ where }),
    ]);

    return {
      data: serializePrisma(data),
      total,
      limit,
      truncated: total > data.length,
    };
  },

  update: async (tenantId, id, checklistData) => {
    await updateOneInTenant(
      prisma.checklist,
      tenantId,
      parseId(id),
      checklistData,
      "Item de checklist não encontrado",
    );
    return checklistModel.getById(tenantId, id);
  },

  delete: async (tenantId, id) => {
    const existing = await checklistModel.getById(tenantId, id);
    if (!existing) {
      const err = new Error("Item de checklist não encontrado");
      err.statusCode = 404;
      throw err;
    }
    await deleteOneInTenant(
      prisma.checklist,
      tenantId,
      parseId(id),
      "Item de checklist não encontrado",
    );
    return existing;
  },
};
