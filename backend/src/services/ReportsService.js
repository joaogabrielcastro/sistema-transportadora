import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const buildDateWhere = ({ startDate, endDate }) => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const range = {};

  if (startDate) {
    range.gte = new Date(startDate);
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    range.lte = end;
  }

  return range;
};

const toKmNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
};

const mergeGroupedCosts = (merged, grouped, { kmMinField, kmMaxField }) => {
  for (const item of grouped) {
    if (item.caminhao_id === null) {
      continue;
    }

    const id = item.caminhao_id;
    const entry = merged.get(id) || {
      totalCost: 0,
      expensesCount: 0,
    };

    entry.totalCost += Number(item._sum.valor || 0);
    entry.expensesCount += item._count._all;

    merged.set(id, entry);
  }
};

/** KM percorrido = último KM cronológico − primeiro KM (mín. 2 lançamentos com KM). */
export function computeKmDrivenFromTimeline(records) {
  const withKm = records
    .map((row) => ({
      date: new Date(row.date),
      km: toKmNumber(row.km),
    }))
    .filter((row) => row.km != null)
    .sort((a, b) => a.date - b.date);

  if (withKm.length < 2) {
    return { kmDriven: null, kmDataInsufficient: true };
  }

  const first = withKm[0].km;
  const last = withKm[withKm.length - 1].km;

  if (last < first) {
    return { kmDriven: null, kmDataInsufficient: true };
  }

  return {
    kmDriven: last - first,
    kmDataInsufficient: false,
  };
}

export class ReportsService {
  static async getOverview() {
    const [totalCaminhoes, gastosAgg, checklistAgg] = await Promise.all([
      prisma.caminhoes.count(),
      prisma.gastos.aggregate({
        _count: { id: true },
        _sum: { valor: true },
      }),
      prisma.checklist.aggregate({
        _count: { id: true },
        _sum: { valor: true },
      }),
    ]);

    const gastosTotal = Number(gastosAgg._sum.valor || 0);
    const manutencoesTotal = Number(checklistAgg._sum.valor || 0);
    const totalRegistros =
      (gastosAgg._count.id || 0) + (checklistAgg._count.id || 0);

    return {
      totalCaminhoes,
      totalGastos: gastosTotal + manutencoesTotal,
      totalManutencoes: checklistAgg._count.id || 0,
      mediaGastos:
        totalRegistros > 0
          ? (gastosTotal + manutencoesTotal) / totalRegistros
          : 0,
      mediaPorLancamento:
        totalRegistros > 0
          ? (gastosTotal + manutencoesTotal) / totalRegistros
          : 0,
    };
  }

  static async getCostPerKm({ startDate, endDate, caminhaoId, entriesLimit = 500 }) {
    const parsedCaminhaoId = parseOptionalInt(caminhaoId);
    const dateWhere = buildDateWhere({ startDate, endDate });
    const limit = Math.min(Math.max(Number(entriesLimit) || 500, 1), 1000);

    const baseWhere = {
      ...(parsedCaminhaoId ? { caminhao_id: parsedCaminhaoId } : {}),
    };

    const gastosDateWhere = dateWhere ? { data_gasto: dateWhere } : {};
    const checklistDateWhere = dateWhere ? { data_manutencao: dateWhere } : {};

    const [
      gastosGrouped,
      checklistGrouped,
      gastosRecords,
      checklistRecords,
      gastosTotalCount,
      checklistTotalCount,
      gastosKmTimeline,
      checklistKmTimeline,
    ] = await Promise.all([
      prisma.gastos.groupBy({
        by: ["caminhao_id"],
        where: { ...baseWhere, ...gastosDateWhere },
        _sum: { valor: true },
        _count: { _all: true },
        orderBy: { caminhao_id: "asc" },
      }),
      prisma.checklist.groupBy({
        by: ["caminhao_id"],
        where: { ...baseWhere, ...checklistDateWhere },
        _sum: { valor: true },
        _count: { _all: true },
        orderBy: { caminhao_id: "asc" },
      }),
      prisma.gastos.findMany({
        where: { ...baseWhere, ...gastosDateWhere },
        select: {
          id: true,
          caminhao_id: true,
          valor: true,
          data_gasto: true,
          descricao: true,
          km_registro: true,
          tipos_gastos: { select: { nome_tipo: true } },
          caminhoes: { select: { placa: true } },
        },
        orderBy: { data_gasto: "desc" },
        take: limit,
      }),
      prisma.checklist.findMany({
        where: { ...baseWhere, ...checklistDateWhere },
        select: {
          id: true,
          caminhao_id: true,
          valor: true,
          data_manutencao: true,
          km_manutencao: true,
          km_registro: true,
          itens_checklist: { select: { nome_item: true } },
          caminhoes: { select: { placa: true } },
        },
        orderBy: { data_manutencao: "desc" },
        take: limit,
      }),
      prisma.gastos.count({ where: { ...baseWhere, ...gastosDateWhere } }),
      prisma.checklist.count({ where: { ...baseWhere, ...checklistDateWhere } }),
      prisma.gastos.findMany({
        where: {
          ...baseWhere,
          ...gastosDateWhere,
          km_registro: { not: null },
        },
        select: {
          caminhao_id: true,
          data_gasto: true,
          km_registro: true,
        },
        orderBy: [{ caminhao_id: "asc" }, { data_gasto: "asc" }],
      }),
      prisma.checklist.findMany({
        where: {
          ...baseWhere,
          ...checklistDateWhere,
          OR: [{ km_manutencao: { not: null } }, { km_registro: { not: null } }],
        },
        select: {
          caminhao_id: true,
          data_manutencao: true,
          km_manutencao: true,
          km_registro: true,
        },
        orderBy: [{ caminhao_id: "asc" }, { data_manutencao: "asc" }],
      }),
    ]);

    const merged = new Map();
    mergeGroupedCosts(merged, gastosGrouped, {
      kmMinField: "km_registro",
      kmMaxField: "km_registro",
    });
    mergeGroupedCosts(merged, checklistGrouped, {
      kmMinField: "km_manutencao",
      kmMaxField: "km_manutencao",
    });

    const kmTimelineByTruck = new Map();

    for (const row of gastosKmTimeline) {
      if (row.caminhao_id == null) continue;
      const list = kmTimelineByTruck.get(row.caminhao_id) || [];
      list.push({ date: row.data_gasto, km: row.km_registro });
      kmTimelineByTruck.set(row.caminhao_id, list);
    }

    for (const row of checklistKmTimeline) {
      if (row.caminhao_id == null) continue;
      const list = kmTimelineByTruck.get(row.caminhao_id) || [];
      const km = row.km_manutencao ?? row.km_registro;
      list.push({ date: row.data_manutencao, km });
      kmTimelineByTruck.set(row.caminhao_id, list);
    }

    const caminhaoIds = [...merged.keys()];

    const caminhoes = caminhaoIds.length
      ? await prisma.caminhoes.findMany({
          where: { id: { in: caminhaoIds } },
          select: { id: true, placa: true },
        })
      : [];

    const placasMap = new Map(caminhoes.map((item) => [item.id, item.placa]));

    const data = caminhaoIds
      .map((caminhao_id) => {
        const item = merged.get(caminhao_id);
        const timeline = kmTimelineByTruck.get(caminhao_id) || [];
        const { kmDriven, kmDataInsufficient } =
          computeKmDrivenFromTimeline(timeline);
        const totalCost = item.totalCost;
        const costPerKm =
          kmDriven && kmDriven > 0 ? totalCost / kmDriven : null;

        return {
          caminhaoId: caminhao_id,
          placa: placasMap.get(caminhao_id) || "Sem placa",
          totalCost,
          kmDriven,
          costPerKm,
          expensesCount: item.expensesCount,
          kmDataInsufficient,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    const entries = [
      ...gastosRecords.map((gasto) => ({
        tipo: "gasto",
        id: gasto.id,
        caminhaoId: gasto.caminhao_id,
        placa: gasto.caminhoes?.placa || "Sem placa",
        descricao:
          gasto.tipos_gastos?.nome_tipo || gasto.descricao || "Gasto",
        data: gasto.data_gasto,
        valor: Number(gasto.valor),
        km: toKmNumber(gasto.km_registro),
      })),
      ...checklistRecords.map((manutencao) => ({
        tipo: "manutencao",
        id: manutencao.id,
        caminhaoId: manutencao.caminhao_id,
        placa: manutencao.caminhoes?.placa || "Sem placa",
        descricao: manutencao.itens_checklist?.nome_item || "Manutenção",
        data: manutencao.data_manutencao,
        valor: Number(manutencao.valor || 0),
        km: toKmNumber(manutencao.km_manutencao ?? manutencao.km_registro),
      })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    const totals = data.reduce(
      (acc, current) => {
        acc.grandTotal += current.totalCost;
        if (typeof current.kmDriven === "number") {
          acc.totalKm += current.kmDriven;
        }
        if (current.kmDataInsufficient) {
          acc.trucksWithInsufficientKm += 1;
        }
        return acc;
      },
      { grandTotal: 0, totalKm: 0, trucksWithInsufficientKm: 0 },
    );

    return serializePrisma({
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        caminhaoId: parsedCaminhaoId || null,
      },
      stats: {
        grandTotal: totals.grandTotal,
        totalKm: totals.totalKm,
        avgCostPerKm:
          totals.totalKm > 0 ? totals.grandTotal / totals.totalKm : 0,
        truckCount: data.length,
        entryCount: entries.length,
        trucksWithInsufficientKm: totals.trucksWithInsufficientKm,
        entriesTruncated:
          gastosRecords.length >= limit ||
          checklistRecords.length >= limit,
        gastosEntriesTruncated: gastosRecords.length >= limit,
        checklistEntriesTruncated: checklistRecords.length >= limit,
        gastosTotalCount,
        checklistTotalCount,
      },
      items: data,
      entries,
    });
  }
}
