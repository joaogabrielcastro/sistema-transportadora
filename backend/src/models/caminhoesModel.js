import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const buildUniquenessWhere = (
  numero_carreta_1,
  placa_carreta_1,
  numero_carreta_2,
  placa_carreta_2,
  numero_cavalo,
) => {
  const or = [];

  if (numero_carreta_1 != null && numero_carreta_1 !== "") {
    or.push(
      { numero_carreta_1: Number(numero_carreta_1) },
      { numero_carreta_2: Number(numero_carreta_1) },
    );
  }

  if (placa_carreta_1 != null && placa_carreta_1 !== "") {
    or.push({ placa_carreta_1 }, { placa_carreta_2: placa_carreta_1 });
  }

  if (numero_carreta_2 != null && numero_carreta_2 !== "") {
    or.push(
      { numero_carreta_1: Number(numero_carreta_2) },
      { numero_carreta_2: Number(numero_carreta_2) },
    );
  }

  if (placa_carreta_2 != null && placa_carreta_2 !== "") {
    or.push({ placa_carreta_1: placa_carreta_2 }, { placa_carreta_2 });
  }

  if (numero_cavalo != null && numero_cavalo !== "") {
    or.push({ numero_cavalo: Number(numero_cavalo) });
  }

  return or;
};

const normalizeCaminhaoData = (caminhaoData) => {
  const allowedFields = [
    "placa",
    "qtd_pneus",
    "km_atual",
    "numero_carreta_1",
    "numero_cavalo",
    "motorista",
    "numero_carreta_2",
    "placa_carreta_1",
    "placa_carreta_2",
    "ano",
    "marca",
    "modelo",
  ];

  return Object.fromEntries(
    Object.entries(caminhaoData).filter(([key, value]) => {
      return allowedFields.includes(key) && value !== undefined;
    }),
  );
};

export const caminhoesModel = {
  checkUniqueness: async (
    numero_carreta_1,
    placa_carreta_1,
    numero_carreta_2,
    placa_carreta_2,
    numero_cavalo,
  ) => {
    const or = buildUniquenessWhere(
      numero_carreta_1,
      placa_carreta_1,
      numero_carreta_2,
      placa_carreta_2,
      numero_cavalo,
    );

    if (or.length === 0) {
      return [];
    }

    const data = await prisma.caminhoes.findMany({
      where: { OR: or },
      select: {
        placa: true,
        numero_carreta_1: true,
        placa_carreta_1: true,
        numero_carreta_2: true,
        placa_carreta_2: true,
        numero_cavalo: true,
      },
    });

    return serializePrisma(data);
  },

  create: async (caminhaoData) => {
    const data = await prisma.caminhoes.create({
      data: normalizeCaminhaoData(caminhaoData),
    });

    return serializePrisma(data);
  },

  getAll: async ({ page = 1, limit = 10, filtro = null, termo = null }) => {
    const noPagination = limit === null || limit === undefined;
    const termoNormalizado = termo?.trim();
    let where;

    if (termoNormalizado) {
      if (filtro === "placa") {
        where = {
          OR: [
            { placa: { contains: termoNormalizado, mode: "insensitive" } },
            {
              placa_carreta_1: {
                contains: termoNormalizado,
                mode: "insensitive",
              },
            },
            {
              placa_carreta_2: {
                contains: termoNormalizado,
                mode: "insensitive",
              },
            },
          ],
        };
      } else if (filtro === "motorista") {
        where = {
          motorista: { contains: termoNormalizado, mode: "insensitive" },
        };
      } else {
        where = {
          OR: [
            { placa: { contains: termoNormalizado, mode: "insensitive" } },
            { motorista: { contains: termoNormalizado, mode: "insensitive" } },
            {
              placa_carreta_1: {
                contains: termoNormalizado,
                mode: "insensitive",
              },
            },
            {
              placa_carreta_2: {
                contains: termoNormalizado,
                mode: "insensitive",
              },
            },
          ],
        };
      }
    }

    const [data, count] = await prisma.$transaction([
      prisma.caminhoes.findMany({
        where,
        orderBy: { placa: "asc" },
        ...(noPagination ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      prisma.caminhoes.count({ where }),
    ]);

    return { data: serializePrisma(data), count };
  },

  getByPlaca: async (placa) => {
    const data = await prisma.caminhoes.findUnique({
      where: { placa },
    });

    return serializePrisma(data);
  },

  getById: async (id) => {
    const data = await prisma.caminhoes.findUnique({
      where: { id: parseId(id) },
    });

    return serializePrisma(data);
  },

  update: async (placa, caminhaoData) => {
    const data = await prisma.caminhoes.update({
      where: { placa },
      data: normalizeCaminhaoData(caminhaoData),
    });

    return serializePrisma(data);
  },

  updateById: async (id, caminhaoData) => {
    const data = await prisma.caminhoes.update({
      where: { id: parseId(id) },
      data: normalizeCaminhaoData(caminhaoData),
    });

    return serializePrisma(data);
  },

  checkDependencies: async (placa) => {
    const caminhao = await prisma.caminhoes.findUnique({
      where: { placa },
      select: { id: true },
    });

    if (!caminhao) {
      throw new Error("Caminhão não encontrado");
    }

    const [gastos, checklists, pneus] = await prisma.$transaction([
      prisma.gastos.count({ where: { caminhao_id: caminhao.id } }),
      prisma.checklist.count({ where: { caminhao_id: caminhao.id } }),
      prisma.pneus.count({ where: { caminhao_id: caminhao.id } }),
    ]);

    return {
      detalhes: {
        gastos,
        checklists,
        pneus,
      },
      total: gastos + checklists + pneus,
    };
  },

  delete: async (placa) => {
    const caminhaoExistente = await prisma.caminhoes.findUnique({
      where: { placa },
      select: { id: true },
    });

    if (!caminhaoExistente) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.caminhoes.delete({
      where: { placa },
    });

    return serializePrisma(data);
  },

  deleteWithCascade: async (placa) => {
    const caminhao = await prisma.caminhoes.findUnique({
      where: { placa },
      select: { id: true },
    });

    if (!caminhao) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.$transaction(async (tx) => {
      await tx.gastos.deleteMany({ where: { caminhao_id: caminhao.id } });
      await tx.checklist.deleteMany({ where: { caminhao_id: caminhao.id } });
      await tx.pneus.deleteMany({ where: { caminhao_id: caminhao.id } });

      return tx.caminhoes.delete({ where: { placa } });
    });

    return serializePrisma(data);
  },

  search: async (term) => {
    const data = await prisma.caminhoes.findMany({
      where: {
        OR: [
          { placa: { contains: term, mode: "insensitive" } },
          { motorista: { contains: term, mode: "insensitive" } },
        ],
      },
      orderBy: { placa: "asc" },
    });

    return serializePrisma(data);
  },
};
