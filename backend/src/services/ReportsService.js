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
  return Number.isNaN(parsed) ? null : parsed;
};

const mergeGroupedCosts = (merged, grouped) => {
  for (const item of grouped) {
    if (item.caminhao_id === null) {
      continue;
    }

    const id = item.caminhao_id;
    const entry = merged.get(id) || {
      totalCost: 0,
      expensesCount: 0,
      kmMin: null,
      kmMax: null,
    };

    entry.totalCost += Number(item._sum.valor || 0);
    entry.expensesCount += item._count._all;

    const kmMin = toKmNumber(item._min.km_registro);
    const kmMax = toKmNumber(item._max.km_registro);

    if (kmMin !== null) {
      entry.kmMin =
        entry.kmMin === null ? kmMin : Math.min(entry.kmMin, kmMin);
    }

    if (kmMax !== null) {
      entry.kmMax =
        entry.kmMax === null ? kmMax : Math.max(entry.kmMax, kmMax);
    }

    merged.set(id, entry);
  }
};

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
    };
  }

  static async getCostPerKm({ startDate, endDate, caminhaoId }) {
    const parsedCaminhaoId = parseOptionalInt(caminhaoId);
    const dateWhere = buildDateWhere({ startDate, endDate });

    const baseWhere = {
      ...(parsedCaminhaoId ? { caminhao_id: parsedCaminhaoId } : {}),
    };

    const [gastosGrouped, checklistGrouped, gastosRecords, checklistRecords] =
      await Promise.all([
      prisma.gastos.groupBy({
        by: ["caminhao_id"],
        where: {
          ...baseWhere,
          ...(dateWhere ? { data_gasto: dateWhere } : {}),
        },
        _sum: { valor: true },
        _count: { _all: true },
        _min: { km_registro: true },
        _max: { km_registro: true },
        orderBy: {
          caminhao_id: "asc",
        },
      }),
      prisma.checklist.groupBy({
        by: ["caminhao_id"],
        where: {
          ...baseWhere,
          ...(dateWhere ? { data_manutencao: dateWhere } : {}),
        },
        _sum: { valor: true },
        _count: { _all: true },
        _min: { km_registro: true },
        _max: { km_registro: true },
        orderBy: {
          caminhao_id: "asc",
        },
      }),
      prisma.gastos.findMany({
        where: {
          ...baseWhere,
          ...(dateWhere ? { data_gasto: dateWhere } : {}),
        },
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
      }),
      prisma.checklist.findMany({
        where: {
          ...baseWhere,
          ...(dateWhere ? { data_manutencao: dateWhere } : {}),
        },
        select: {
          id: true,
          caminhao_id: true,
          valor: true,
          data_manutencao: true,
          km_registro: true,
          itens_checklist: { select: { nome_item: true } },
          caminhoes: { select: { placa: true } },
        },
        orderBy: { data_manutencao: "desc" },
      }),
    ]);

    const merged = new Map();
    mergeGroupedCosts(merged, gastosGrouped);
    mergeGroupedCosts(merged, checklistGrouped);

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
        const kmDriven =
          item.kmMin !== null &&
          item.kmMax !== null &&
          item.kmMax >= item.kmMin
            ? item.kmMax - item.kmMin
            : null;
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
        km: toKmNumber(manutencao.km_registro),
      })),
    ].sort((a, b) => new Date(b.data) - new Date(a.data));

    const totals = data.reduce(
      (acc, current) => {
        acc.grandTotal += current.totalCost;
        if (typeof current.kmDriven === "number") {
          acc.totalKm += current.kmDriven;
        }
        return acc;
      },
      { grandTotal: 0, totalKm: 0 },
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
      },
      items: data,
      entries,
    });
  }
}
