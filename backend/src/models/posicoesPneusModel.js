import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

export const posicoesPneusModel = {
  getAll: async () => {
    const data = await prisma.posicoes_pneus.findMany({
      orderBy: { nome_posicao: "asc" },
    });

    return serializePrisma(data);
  },
};