import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

const gastoInclude = {
  caminhoes: {
    select: {
      placa: true,
    },
  },
  tipos_gastos: {
    select: {
      nome_tipo: true,
    },
  },
};

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export const gastosModel = {
  create: async (gastoData) => {
    const data = await prisma.gastos.create({
      data: gastoData,
      include: gastoInclude,
    });

    return serializePrisma(data);
  },

  getAll: async ({ page = 1, limit = 10, caminhaoId = null }) => {
    const skip = (page - 1) * limit;
    const where = caminhaoId ? { caminhao_id: parseId(caminhaoId) } : undefined;

    const [data, count] = await prisma.$transaction([
      prisma.gastos.findMany({
        where,
        include: gastoInclude,
        orderBy: { data_gasto: "desc" },
        skip,
        take: limit,
      }),
      prisma.gastos.count({ where }),
    ]);

    return { data: serializePrisma(data), count };
  },

  getById: async (id) => {
    const data = await prisma.gastos.findUnique({
      where: { id: parseId(id) },
      include: gastoInclude,
    });

    return serializePrisma(data);
  },

  getByCaminhaoId: async (caminhaoId) => {
    const data = await prisma.gastos.findMany({
      where: { caminhao_id: parseId(caminhaoId) },
      include: {
        tipos_gastos: {
          select: {
            nome_tipo: true,
          },
        },
      },
      orderBy: { data_gasto: "desc" },
    });

    return serializePrisma(data);
  },

  update: async (id, gastoData) => {
    const data = await prisma.gastos.update({
      where: { id: parseId(id) },
      data: gastoData,
      include: gastoInclude,
    });

    return serializePrisma(data);
  },

  delete: async (id) => {
    const data = await prisma.gastos.delete({
      where: { id: parseId(id) },
    });

    return serializePrisma(data);
  },

  getConsumoCombustivel: async (id) => {
    const ID_TIPO_GASTO_COMBUSTIVEL = 9;

    const data = await prisma.gastos.findMany({
      where: {
        caminhao_id: parseId(id),
        tipo_gasto_id: ID_TIPO_GASTO_COMBUSTIVEL,
        km_registro: { not: null },
        quantidade_combustivel: { not: null },
      },
      select: {
        km_registro: true,
        quantidade_combustivel: true,
      },
      orderBy: { km_registro: "desc" },
    });

    return serializePrisma(data);
  },
};
