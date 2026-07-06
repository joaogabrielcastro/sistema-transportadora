import prisma from "../lib/prisma.js";
import { normalizePlaca } from "../utils/placa.js";
import { parseListLimit } from "../utils/listLimits.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

const gastosInclude = {
  caminhoes: { select: { placa: true } },
  tipos_gastos: { select: { nome_tipo: true } },
};

const checklistInclude = {
  caminhoes: { select: { placa: true } },
  itens_checklist: { select: { nome_item: true } },
};

function mapGastoRow(g) {
  return {
    ...g,
    tipo_registro: "Gasto",
    nome_tipo: g.tipos_gastos?.nome_tipo,
    placa: g.caminhoes?.placa,
    data: g.data_gasto,
    observacao: g.descricao,
    oficina: "N/A",
    km_registro: g.km_registro ?? "N/A",
    quantidade_combustivel: g.quantidade_combustivel ?? "N/A",
  };
}

function mapChecklistRow(c) {
  return {
    ...c,
    tipo_registro: "Manutenção",
    nome_tipo: c.itens_checklist?.nome_item,
    placa: c.caminhoes?.placa,
    data: c.data_manutencao,
    valor: c.valor ?? "N/A",
    observacao: c.observacao,
    oficina: c.oficina || "N/A",
    km_registro: c.km_manutencao ?? "N/A",
    quantidade_combustivel: "N/A",
  };
}

function buildCaminhaoFilter({ caminhaoId, placa }) {
  if (caminhaoId) {
    return { caminhao_id: Number(caminhaoId) };
  }

  if (placa?.trim()) {
    const normalized = normalizePlaca(placa);
    return {
      caminhoes: {
        placa: { contains: normalized, mode: "insensitive" },
      },
    };
  }

  return {};
}

export class RegistrosService {
  static async list({ page = 1, limit = 20, caminhaoId, placa } = {}) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = parseListLimit(limit, 20);
    const skip = (parsedPage - 1) * parsedLimit;
    const fetchSize = skip + parsedLimit;

    const caminhaoFilter = buildCaminhaoFilter({ caminhaoId, placa });

    const [gastosCount, checklistCount, gastos, checklists] =
      await Promise.all([
        prisma.gastos.count({ where: caminhaoFilter }),
        prisma.checklist.count({ where: caminhaoFilter }),
        prisma.gastos.findMany({
          where: caminhaoFilter,
          include: gastosInclude,
          orderBy: { data_gasto: "desc" },
          take: fetchSize,
        }),
        prisma.checklist.findMany({
          where: caminhaoFilter,
          include: checklistInclude,
          orderBy: { data_manutencao: "desc" },
          take: fetchSize,
        }),
      ]);

    const merged = [
      ...gastos.map(mapGastoRow),
      ...checklists.map(mapChecklistRow),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    const totalItems = gastosCount + checklistCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / parsedLimit));
    const data = merged.slice(skip, skip + parsedLimit);

    return serializePrisma({
      data,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems,
        itemsPerPage: parsedLimit,
      },
    });
  }
}
