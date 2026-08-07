import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { caminhoesModel } from "../models/caminhoesModel.js";

const withTenant = (tenantId, where = {}) => ({
  ...where,
  tenant_id: Number(tenantId),
});

export class ComposicaoService {
  static async listarPorCavalo(tenantId, cavaloId) {
    const rows = await prisma.vinculos_composicao.findMany({
      where: withTenant(tenantId, {
        cavalo_id: Number(cavaloId),
        ativo: true,
      }),
      include: {
        carreta: {
          select: {
            id: true,
            placa: true,
            tipo_veiculo: true,
            qtd_pneus: true,
            modelo: true,
            marca: true,
            config_eixos: true,
          },
        },
      },
      orderBy: { ordem: "asc" },
    });
    return serializePrisma(rows);
  }

  static async listarAtivosDoVeiculo(tenantId, veiculoId) {
    const id = Number(veiculoId);
    const asCavalo = await this.listarPorCavalo(tenantId, id);
    if (asCavalo.length) {
      return { papel: "cavalo", vinculos: asCavalo };
    }

    const asCarreta = await prisma.vinculos_composicao.findFirst({
      where: withTenant(tenantId, { carreta_id: id, ativo: true }),
      include: {
        cavalo: {
          select: {
            id: true,
            placa: true,
            tipo_veiculo: true,
            qtd_pneus: true,
            modelo: true,
            marca: true,
            config_eixos: true,
          },
        },
        carreta: {
          select: {
            id: true,
            placa: true,
            tipo_veiculo: true,
            qtd_pneus: true,
            modelo: true,
            marca: true,
            config_eixos: true,
          },
        },
      },
    });

    if (asCarreta) {
      return { papel: "carreta", vinculos: [serializePrisma(asCarreta)] };
    }

    return { papel: null, vinculos: [] };
  }

  static async vincular(tenantId, cavaloId, { carreta_id, ordem = 1 }) {
    const cavalo = await caminhoesModel.getById(tenantId, cavaloId);
    if (!cavalo) {
      const err = new Error("Cavalo não encontrado");
      err.statusCode = 404;
      throw err;
    }
    if (cavalo.tipo_veiculo !== "cavalo" && cavalo.tipo_veiculo !== "truck") {
      const err = new Error(
        "Só é possível vincular carreta a um cavalo ou truck",
      );
      err.statusCode = 400;
      throw err;
    }

    const carreta = await caminhoesModel.getById(tenantId, carreta_id);
    if (!carreta) {
      const err = new Error("Carreta não encontrada");
      err.statusCode = 404;
      throw err;
    }
    if (carreta.tipo_veiculo !== "carreta") {
      const err = new Error("O veículo alvo precisa ser do tipo carreta");
      err.statusCode = 400;
      throw err;
    }

    if (cavalo.tipo_veiculo === "truck") {
      await caminhoesModel.updateById(tenantId, cavalo.id, {
        tipo_veiculo: "cavalo",
      });
    }

    const existente = await prisma.vinculos_composicao.findFirst({
      where: withTenant(tenantId, {
        carreta_id: Number(carreta_id),
        ativo: true,
      }),
    });
    if (existente) {
      const err = new Error(
        "Esta carreta já está vinculada a outro cavalo. Desvincule antes.",
      );
      err.statusCode = 409;
      throw err;
    }

    const ativoNoCavalo = await prisma.vinculos_composicao.count({
      where: withTenant(tenantId, {
        cavalo_id: Number(cavaloId),
        ativo: true,
      }),
    });
    if (ativoNoCavalo >= 2) {
      const err = new Error("Cavalo já possui 2 carretas vinculadas");
      err.statusCode = 400;
      throw err;
    }

    const row = await prisma.vinculos_composicao.create({
      data: {
        tenant_id: Number(tenantId),
        cavalo_id: Number(cavaloId),
        carreta_id: Number(carreta_id),
        ordem: Number(ordem) || ativoNoCavalo + 1,
        ativo: true,
      },
      include: {
        carreta: {
          select: {
            id: true,
            placa: true,
            tipo_veiculo: true,
            qtd_pneus: true,
            modelo: true,
            marca: true,
          },
        },
      },
    });

    return serializePrisma(row);
  }

  static async desvincular(tenantId, vinculoId) {
    const row = await prisma.vinculos_composicao.findFirst({
      where: withTenant(tenantId, { id: Number(vinculoId), ativo: true }),
    });
    if (!row) {
      const err = new Error("Vínculo não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.vinculos_composicao.update({
      where: { id: row.id },
      data: { ativo: false, fim_em: new Date() },
    });

    return serializePrisma(updated);
  }
}
