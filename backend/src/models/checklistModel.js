import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

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

export const checklistModel = {
  create: async (checklistData) => {
    const data = await prisma.checklist.create({
      data: checklistData,
      include: checklistInclude,
    });

    return serializePrisma(data);
  },

  getAll: async ({ page = 1, limit = 10, caminhaoId = null }) => {
    const skip = (page - 1) * limit;
    const where = caminhaoId ? { caminhao_id: parseId(caminhaoId) } : undefined;

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

  getById: async (id) => {
    const data = await prisma.checklist.findUnique({
      where: { id: parseId(id) },
      include: checklistInclude,
    });

    return serializePrisma(data);
  },

  getByCaminhaoId: async (caminhaoId) => {
    const data = await prisma.checklist.findMany({
      where: { caminhao_id: parseId(caminhaoId) },
      include: {
        itens_checklist: {
          select: {
            nome_item: true,
          },
        },
      },
      orderBy: { data_manutencao: "desc" },
    });

    return serializePrisma(data);
  },

  update: async (id, checklistData) => {
    const data = await prisma.checklist.update({
      where: { id: parseId(id) },
      data: checklistData,
      include: checklistInclude,
    });

    return serializePrisma(data);
  },

  delete: async (id) => {
    const data = await prisma.checklist.delete({
      where: { id: parseId(id) },
    });

    return serializePrisma(data);
  },
};
