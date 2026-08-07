import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { normalizePlaca } from "../utils/placa.js";

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
    or.push(
      { placa_carreta_1: { equals: placa_carreta_1, mode: "insensitive" } },
      { placa_carreta_2: { equals: placa_carreta_1, mode: "insensitive" } },
    );
  }

  if (numero_carreta_2 != null && numero_carreta_2 !== "") {
    or.push(
      { numero_carreta_1: Number(numero_carreta_2) },
      { numero_carreta_2: Number(numero_carreta_2) },
    );
  }

  if (placa_carreta_2 != null && placa_carreta_2 !== "") {
    or.push(
      { placa_carreta_1: { equals: placa_carreta_2, mode: "insensitive" } },
      { placa_carreta_2: { equals: placa_carreta_2, mode: "insensitive" } },
    );
  }

  if (numero_cavalo != null && numero_cavalo !== "") {
    const n = Number(numero_cavalo);
    if (!Number.isNaN(n)) {
      or.push({ numero_cavalo: n });
    }
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
    "motorista_id",
    "numero_carreta_2",
    "placa_carreta_1",
    "placa_carreta_2",
    "ano",
    "marca",
    "modelo",
    "tipo_veiculo",
    "config_eixos",
    "com_4_eixo",
    "chassi",
    "empresa",
  ];

  return Object.fromEntries(
    Object.entries(caminhaoData).filter(([key, value]) => {
      return allowedFields.includes(key) && value !== undefined;
    }),
  );
};

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

export const caminhoesModel = {
  checkUniqueness: async (
    tenantId,
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
      where: withTenant(tenantId, { OR: or }),
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

  create: async (tenantId, caminhaoData) => {
    const data = await prisma.caminhoes.create({
      data: {
        ...normalizeCaminhaoData(caminhaoData),
        tenant_id: Number(tenantId),
      },
    });

    return serializePrisma(data);
  },

  getAll: async ({
    tenantId,
    page = 1,
    limit = 10,
    filtro = null,
    termo = null,
    tipo_veiculo = null,
  }) => {
    const noPagination = limit === null || limit === undefined;
    const termoNormalizado = termo?.trim();
    const tipoNormalizado = String(tipo_veiculo || "")
      .toLowerCase()
      .trim();
    const tipoValido = ["truck", "cavalo", "carreta"].includes(tipoNormalizado)
      ? tipoNormalizado
      : null;

    const conditions = [];

    if (tipoValido) {
      conditions.push({ tipo_veiculo: tipoValido });
    }

    if (termoNormalizado) {
      if (filtro === "placa") {
        conditions.push({
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
        });
      } else if (filtro === "motorista") {
        conditions.push({
          motorista: { contains: termoNormalizado, mode: "insensitive" },
        });
      } else {
        conditions.push({
          OR: [
            { placa: { contains: termoNormalizado, mode: "insensitive" } },
            { motorista: { contains: termoNormalizado, mode: "insensitive" } },
            { modelo: { contains: termoNormalizado, mode: "insensitive" } },
            { marca: { contains: termoNormalizado, mode: "insensitive" } },
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
        });
      }
    }

    const where = withTenant(
      tenantId,
      conditions.length ? { AND: conditions } : {},
    );

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

  getByPlaca: async (tenantId, placa) => {
    const normalized = normalizePlaca(placa);
    if (!normalized) return null;

    const data = await prisma.caminhoes.findUnique({
      where: {
        tenant_id_placa: {
          tenant_id: Number(tenantId),
          placa: normalized,
        },
      },
      include: {
        motorista_ref: {
          select: { id: true, nome: true, cpf: true, cnh: true },
        },
      },
    });

    return serializePrisma(data);
  },

  getById: async (tenantId, id) => {
    const data = await prisma.caminhoes.findFirst({
      where: withTenant(tenantId, { id: parseId(id) }),
      include: {
        motorista_ref: {
          select: { id: true, nome: true, cpf: true, cnh: true },
        },
      },
    });

    return serializePrisma(data);
  },

  update: async (tenantId, placa, caminhaoData) => {
    const existing = await caminhoesModel.getByPlaca(tenantId, placa);
    if (!existing) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.caminhoes.update({
      where: { id: existing.id },
      data: normalizeCaminhaoData(caminhaoData),
    });

    return serializePrisma(data);
  },

  updateById: async (tenantId, id, caminhaoData) => {
    const existing = await caminhoesModel.getById(tenantId, id);
    if (!existing) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.caminhoes.update({
      where: { id: existing.id },
      data: normalizeCaminhaoData(caminhaoData),
    });

    return serializePrisma(data);
  },

  checkDependencies: async (tenantId, placa) => {
    const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);

    if (!caminhao) {
      throw new Error("Caminhão não encontrado");
    }

    const caminhaoId = caminhao.id;

    const [gastos, checklists, pneus, documentos, ordensEnvio] =
      await prisma.$transaction([
        prisma.gastos.count({
          where: withTenant(tenantId, { caminhao_id: caminhaoId }),
        }),
        prisma.checklist.count({
          where: withTenant(tenantId, { caminhao_id: caminhaoId }),
        }),
        prisma.pneus.count({
          where: withTenant(tenantId, { caminhao_id: caminhaoId }),
        }),
        prisma.caminhao_documentos.count({
          where: withTenant(tenantId, { caminhao_id: caminhaoId }),
        }),
        prisma.ordens_coleta_envio.count({
          where: withTenant(tenantId, { caminhao_id: caminhaoId }),
        }),
      ]);

    return {
      detalhes: {
        gastos,
        checklists,
        pneus,
        documentos,
        ordens_envio: ordensEnvio,
      },
      total: gastos + checklists + pneus + documentos,
    };
  },

  delete: async (tenantId, placa) => {
    const caminhaoExistente = await caminhoesModel.getByPlaca(tenantId, placa);

    if (!caminhaoExistente) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.caminhoes.delete({
      where: { id: caminhaoExistente.id },
    });

    return serializePrisma(data);
  },

  deleteWithCascade: async (tenantId, placa) => {
    const caminhao = await caminhoesModel.getByPlaca(tenantId, placa);

    if (!caminhao) {
      throw new Error("Caminhão não encontrado");
    }

    const data = await prisma.$transaction(async (tx) => {
      await tx.gastos.deleteMany({
        where: withTenant(tenantId, { caminhao_id: caminhao.id }),
      });
      await tx.checklist.deleteMany({
        where: withTenant(tenantId, { caminhao_id: caminhao.id }),
      });
      await tx.pneus.deleteMany({
        where: withTenant(tenantId, { caminhao_id: caminhao.id }),
      });
      await tx.ordens_coleta_envio.deleteMany({
        where: withTenant(tenantId, { caminhao_id: caminhao.id }),
      });

      return tx.caminhoes.delete({ where: { id: caminhao.id } });
    });

    return serializePrisma(data);
  },

  search: async (tenantId, term, tipo_veiculo = null) => {
    const tipoNormalizado = String(tipo_veiculo || "")
      .toLowerCase()
      .trim();
    const tipoValido = ["truck", "cavalo", "carreta"].includes(tipoNormalizado)
      ? tipoNormalizado
      : null;

    const conditions = [
      {
        OR: [
          { placa: { contains: term, mode: "insensitive" } },
          { motorista: { contains: term, mode: "insensitive" } },
          { modelo: { contains: term, mode: "insensitive" } },
          { marca: { contains: term, mode: "insensitive" } },
        ],
      },
    ];

    if (tipoValido) {
      conditions.push({ tipo_veiculo: tipoValido });
    }

    const data = await prisma.caminhoes.findMany({
      where: withTenant(tenantId, { AND: conditions }),
      orderBy: { placa: "asc" },
    });

    return serializePrisma(data);
  },
};
