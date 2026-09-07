import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";
import { dedupeTiposGastos } from "../utils/tiposGastosCatalog.js";

export const tiposGastosModel = {
  getAll: async () => {
    const data = await prisma.tipos_gastos.findMany({
      orderBy: { nome_tipo: "asc" },
    });

    return serializePrisma(dedupeTiposGastos(data));
  },
};
