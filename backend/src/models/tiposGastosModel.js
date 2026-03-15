import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

export const tiposGastosModel = {
  getAll: async () => {
    const data = await prisma.tipos_gastos.findMany({
      orderBy: { nome_tipo: "asc" },
    });

    return serializePrisma(data);
  },
};
