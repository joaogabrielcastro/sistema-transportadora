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

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

export const pneusModel = {
  create: async (tenantId, pneuData) => {
    const data = await prisma.pneus.create({
      data: {
        ...normalizePneuData(pneuData),
        tenant_id: Number(tenantId),
      },
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  createBulk: async (tenantId, pneusData) => {
    const created = await prisma.$transaction(
      pneusData.map((pneuData) =>
        prisma.pneus.create({
          data: {
            ...normalizePneuData(pneuData),
            tenant_id: Number(tenantId),
          },
          include: pneuInclude,
        }),
      ),
    );

    return serializePrisma(created);
  },

  getAll: async (tenantId, { limit = MAX_LIST_LIMIT } = {}) => {
    const data = await prisma.pneus.findMany({
      where: withTenant(tenantId),
      include: pneuInclude,
      orderBy: { id: "desc" },
      take: limit,
    });

    return serializePrisma(data);
  },

  getById: async (tenantId, id) => {
    const data = await prisma.pneus.findFirst({
      where: withTenant(tenantId, { id: parseId(id) }),
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  getInStock: async (tenantId, { limit = MAX_LIST_LIMIT } = {}) => {
    const data = await prisma.pneus.findMany({
      where: withTenant(tenantId, { caminhao_id: null }),
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

  getByCaminhaoId: async (tenantId, caminhaoId, { limit = MAX_LIST_LIMIT } = {}) => {
    const data = await prisma.pneus.findMany({
      where: withTenant(tenantId, { caminhao_id: parseId(caminhaoId) }),
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

  update: async (tenantId, id, pneuData) => {
    const data = await prisma.pneus.update({
      where: { id: parseId(id) },
      data: normalizePneuData(pneuData),
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  delete: async (tenantId, id) => {
    const data = await prisma.pneus.delete({
      where: { id: parseId(id) },
    });

    return serializePrisma(data);
  },

  assignFromStock: async (tenantId, pneuId, updates) => {
    const existing = await prisma.pneus.findFirst({
      where: withTenant(tenantId, { id: parseId(pneuId) }),
      select: { id: true, caminhao_id: true },
    });

    if (!existing) {
      throw new Error("Pneu não encontrado");
    }

    if (existing.caminhao_id != null) {
      const err = new Error(
        "Este pneu já está instalado em um caminhão. Remova-o antes de reatribuir.",
      );
      err.code = "PNEU_NOT_IN_STOCK";
      throw err;
    }

    const safeUpdates = normalizePneuData(updates);
    delete safeUpdates.id;
    delete safeUpdates.stock_pneu_id;

    if (safeUpdates.caminhao_id && safeUpdates.posicao_id) {
      const duplicate = await prisma.pneus.findFirst({
        where: withTenant(tenantId, {
          caminhao_id: safeUpdates.caminhao_id,
          posicao_id: safeUpdates.posicao_id,
          NOT: { id: parseId(pneuId) },
        }),
        select: { id: true },
      });

      if (duplicate) {
        const err = new Error(
          "Já existe um pneu nesta posição para o caminhão selecionado.",
        );
        err.code = "PNEU_DUPLICATE_POSITION";
        throw err;
      }
    }

    const data = await prisma.pneus.update({
      where: { id: parseId(pneuId) },
      data: safeUpdates,
      include: pneuInclude,
    });

    return serializePrisma(data);
  },

  findAndAssignStock: async (tenantId, criteria, updates) => {
    const candidate = await prisma.pneus.findFirst({
      where: withTenant(tenantId, {
        caminhao_id: null,
        marca: criteria.marca,
        modelo: criteria.modelo,
      }),
      orderBy: [{ criado_em: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    if (!candidate) {
      return null;
    }

    return pneusModel.assignFromStock(tenantId, candidate.id, updates);
  },

  buildListWhere(tenantId, { caminhaoId, emUso, placa } = {}) {
    const where = withTenant(tenantId);

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

  listPaginated: async (
    tenantId,
    {
      page = 1,
      limit = 20,
      caminhaoId,
      emUso,
      placa,
      includeStockStatusCounts = false,
    } = {},
  ) => {
    const where = pneusModel.buildListWhere(tenantId, { caminhaoId, emUso, placa });
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
          where: withTenant(tenantId, { caminhao_id: null }),
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
