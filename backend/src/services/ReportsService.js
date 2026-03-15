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
    range.lte = new Date(endDate);
  }

  return range;
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

    const where = {
      ...(parsedCaminhaoId ? { caminhao_id: parsedCaminhaoId } : {}),
      ...(dateWhere ? { data_gasto: dateWhere } : {}),
    };

    const grouped = await prisma.gastos.groupBy({
      by: ["caminhao_id"],
      where,
      _sum: { valor: true },
      _count: { _all: true },
      _min: { km_registro: true },
      _max: { km_registro: true },
      orderBy: {
        caminhao_id: "asc",
      },
    });

    const caminhaoIds = grouped
      .map((item) => item.caminhao_id)
      .filter((id) => typeof id === "number");

    const caminhoes = caminhaoIds.length
      ? await prisma.caminhoes.findMany({
          where: { id: { in: caminhaoIds } },
          select: { id: true, placa: true },
        })
      : [];

    const placasMap = new Map(caminhoes.map((item) => [item.id, item.placa]));

    const data = grouped
      .filter((item) => item.caminhao_id !== null)
      .map((item) => {
        const kmMin = item._min.km_registro;
        const kmMax = item._max.km_registro;
        const kmDriven =
          kmMin !== null && kmMax !== null && kmMax >= kmMin
            ? kmMax - kmMin
            : null;
        const totalCost = Number(item._sum.valor || 0);
        const costPerKm =
          kmDriven && kmDriven > 0 ? totalCost / kmDriven : null;

        return {
          caminhaoId: item.caminhao_id,
          placa: placasMap.get(item.caminhao_id) || "Sem placa",
          totalCost,
          kmDriven,
          costPerKm,
          expensesCount: item._count._all,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

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
      },
      items: data,
    });
  }
}
