import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { MAX_LIST_LIMIT } from "../utils/listLimits.js";

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

  getAll: async ({ limit = MAX_LIST_LIMIT } = {}) => {
    const data = await prisma.pneus.findMany({
      include: pneuInclude,
      orderBy: { id: "desc" },
      take: limit,
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

  getInStock: async ({ limit = MAX_LIST_LIMIT } = {}) => {
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
      take: limit,
    });

    return serializePrisma(data);
  },

  getByCaminhaoId: async (caminhaoId, { limit = MAX_LIST_LIMIT } = {}) => {
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
      take: limit,
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

  buildListWhere({ caminhaoId, emUso, placa } = {}) {
    const where = {};

    if (caminhaoId != null && caminhaoId !== "") {
      where.caminhao_id = parseId(caminhaoId);
      return where;
    }

    if (emUso === true) {
      where.caminhao_id = { not: null };
    } else if (emUso === false) {
      where.caminhao_id = null;
    }

    const placaNorm = String(placa || "")
      .trim()
      .toUpperCase()
      .replace(/-/g, "");
    if (placaNorm) {
      where.caminhoes = {
        placa: { contains: placaNorm, mode: "insensitive" },
      };
    }

    return where;
  },

  listPaginated: async ({
    page = 1,
    limit = 20,
    caminhaoId,
    emUso,
    placa,
    includeStockStatusCounts = false,
  } = {}) => {
    const where = pneusModel.buildListWhere({ caminhaoId, emUso, placa });
    const skip = (page - 1) * limit;

    const queries = [
      prisma.pneus.findMany({
        where,
        include: pneuInclude,
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.pneus.count({ where }),
    ];

    if (includeStockStatusCounts) {
      queries.push(
        prisma.pneus.groupBy({
          by: ["status_id"],
          where: { caminhao_id: null },
          _count: { _all: true },
        }),
      );
    }

    const results = await prisma.$transaction(queries);
    const data = results[0];
    const count = results[1];
    const statusGroups = includeStockStatusCounts ? results[2] : null;

    const meta = {};
    if (statusGroups) {
      meta.statusCounts = statusGroups.map((g) => ({
        status_id: g.status_id,
        count: g._count._all,
      }));
    }

    return {
      data: serializePrisma(data),
      count,
      meta,
    };
  },
};
