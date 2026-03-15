import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

const pneuInclude = {
  caminhoes: {
    select: {
      placa: true,
    },
  },
  posicoes_pneus: {
    select: {
      nome_posicao: true,
    },
  },
  status_pneus: {
    select: {
      nome_status: true,
    },
  },
};

const normalizePneuData = (pneuData) => {
  const allowedFields = [
    "caminhao_id",
    "posicao_id",
    "status_id",
    "vida_util_km",
    "marca",
    "modelo",
    "data_instalacao",
    "km_instalacao",
    "observacao",
  ];

  return Object.fromEntries(
    Object.entries(pneuData).filter(([key, value]) => {
      return allowedFields.includes(key) && value !== undefined;
    }),
  );
};

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export const pneusModel = {
  create: async (pneuData) => {
    const data = await prisma.pneus.create({
      data: normalizePneuData(pneuData),
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  createBulk: async (pneusData) => {
    const created = await prisma.$transaction(
      pneusData.map((pneuData) =>
        prisma.pneus.create({
          data: normalizePneuData(pneuData),
          include: pneuInclude,
        }),
      ),
    );

    return serializePrisma(created);
  },

  getAll: async () => {
    const data = await prisma.pneus.findMany({
      include: pneuInclude,
      orderBy: { id: "desc" },
    });

    return serializePrisma(data);
  },

  getById: async (id) => {
    const data = await prisma.pneus.findUnique({
      where: { id: parseId(id) },
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  getInStock: async () => {
    const data = await prisma.pneus.findMany({
      where: { caminhao_id: null },
      include: {
        posicoes_pneus: {
          select: {
            nome_posicao: true,
          },
        },
        status_pneus: {
          select: {
            nome_status: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    return serializePrisma(data);
  },

  getByCaminhaoId: async (caminhaoId) => {
    const data = await prisma.pneus.findMany({
      where: { caminhao_id: parseId(caminhaoId) },
      include: {
        posicoes_pneus: {
          select: {
            nome_posicao: true,
          },
        },
        status_pneus: {
          select: {
            nome_status: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    return serializePrisma(data);
  },

  update: async (id, pneuData) => {
    const data = await prisma.pneus.update({
      where: { id: parseId(id) },
      data: normalizePneuData(pneuData),
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  delete: async (id) => {
    const data = await prisma.pneus.delete({
      where: { id: parseId(id) },
    });

    return serializePrisma(data);
  },

  assignFromStock: async (pneuId, updates) => {
    const safeUpdates = normalizePneuData(updates);

    delete safeUpdates.id;
    delete safeUpdates.stock_pneu_id;

    const data = await prisma.pneus.update({
      where: { id: parseId(pneuId) },
      data: safeUpdates,
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  findAndAssignStock: async (criteria, updates) => {
    const candidate = await prisma.pneus.findFirst({
      where: {
        caminhao_id: null,
        marca: criteria.marca,
        modelo: criteria.modelo,
      },
      orderBy: [{ criado_em: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    if (!candidate) {
      return null;
    }

    return pneusModel.assignFromStock(candidate.id, updates);
  },
};
