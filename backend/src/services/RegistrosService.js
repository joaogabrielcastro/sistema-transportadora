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

function buildCaminhaoFilter(tenantId, { caminhaoId, placa }) {
  const base = { tenant_id: Number(tenantId) };

  if (caminhaoId) {
    return { ...base, caminhao_id: Number(caminhaoId) };
  }

  if (placa?.trim()) {
    const normalized = normalizePlaca(placa);
    return {
      ...base,
      caminhoes: {
        placa: { contains: normalized, mode: "insensitive" },
      },
    };
  }

  return base;
}

function buildDateRangeFilter(dataInicio, dataFim, field) {
  if (!dataInicio && !dataFim) return {};

  const range = {};
  if (dataInicio) {
    range.gte = new Date(`${dataInicio}T00:00:00.000Z`);
  }
  if (dataFim) {
    range.lte = new Date(`${dataFim}T23:59:59.999Z`);
  }
  return { [field]: range };
}

function buildGastosWhere(tenantId, filters) {
  return {
    ...buildCaminhaoFilter(tenantId, filters),
    ...buildDateRangeFilter(filters.dataInicio, filters.dataFim, "data_gasto"),
  };
}

function buildChecklistWhere(tenantId, filters) {
  return {
    ...buildCaminhaoFilter(tenantId, filters),
    ...buildDateRangeFilter(
      filters.dataInicio,
      filters.dataFim,
      "data_manutencao",
    ),
  };
}

function toTime(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function endOfTodayMs() {
  const n = new Date();
  n.setHours(23, 59, 59, 999);
  return n.getTime();
}

/**
 * Ordena histórico: data mais recente primeiro.
 * Datas futuras (erros de OCR/import) vão para o fim — não ocupam o topo.
 * Empate: id maior (registro mais novo) primeiro.
 */
export function compareRegistrosByDateDesc(a, b) {
  const todayEnd = endOfTodayMs();
  let ta = toTime(a.data);
  let tb = toTime(b.data);

  const aFuture = ta != null && ta > todayEnd;
  const bFuture = tb != null && tb > todayEnd;

  if (aFuture !== bFuture) return aFuture ? 1 : -1;

  ta = ta ?? Number.NEGATIVE_INFINITY;
  tb = tb ?? Number.NEGATIVE_INFINITY;
  if (tb !== ta) return tb - ta;

  return (Number(b.id) || 0) - (Number(a.id) || 0);
}

function sumDecimal(value) {
  return Number(value ?? 0);
}

export class RegistrosService {
  static async list(
    tenantId,
    {
      page = 1,
      limit = 20,
      caminhaoId,
      placa,
      dataInicio,
      dataFim,
      tipo = "todos",
    } = {},
  ) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedLimit = parseListLimit(limit, 20);
    const skip = (parsedPage - 1) * parsedLimit;
    const fetchSize = skip + parsedLimit;

    const filters = { caminhaoId, placa, dataInicio, dataFim };
    const includeGastos = tipo !== "manutencao";
    const includeChecklist = tipo !== "gasto";

    const gastosWhere = includeGastos ? buildGastosWhere(tenantId, filters) : null;
    const checklistWhere = includeChecklist
      ? buildChecklistWhere(tenantId, filters)
      : null;

    const [
      gastosCount,
      checklistCount,
      gastosAgg,
      checklistAgg,
      gastos,
      checklists,
    ] = await Promise.all([
      includeGastos
        ? prisma.gastos.count({ where: gastosWhere })
        : Promise.resolve(0),
      includeChecklist
        ? prisma.checklist.count({ where: checklistWhere })
        : Promise.resolve(0),
      includeGastos
        ? prisma.gastos.aggregate({
            where: gastosWhere,
            _sum: { valor: true },
          })
        : Promise.resolve({ _sum: { valor: null } }),
      includeChecklist
        ? prisma.checklist.aggregate({
            where: checklistWhere,
            _sum: { valor: true },
          })
        : Promise.resolve({ _sum: { valor: null } }),
      includeGastos
        ? prisma.gastos.findMany({
            where: gastosWhere,
            include: gastosInclude,
            orderBy: [{ id: "desc" }],
            take: fetchSize,
          })
        : Promise.resolve([]),
      includeChecklist
        ? prisma.checklist.findMany({
            where: checklistWhere,
            include: checklistInclude,
            orderBy: [{ id: "desc" }],
            take: fetchSize,
          })
        : Promise.resolve([]),
    ]);

    const merged = [
      ...gastos.map(mapGastoRow),
      ...checklists.map(mapChecklistRow),
    ].sort(compareRegistrosByDateDesc);

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
      summary: {
        totalRegistros: totalItems,
        totalGastos: sumDecimal(gastosAgg._sum?.valor),
        totalManutencoes: sumDecimal(checklistAgg._sum?.valor),
        countGastos: gastosCount,
        countManutencoes: checklistCount,
      },
    });
  }
}
