import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

export const itensChecklistModel = {
  getAll: async () => {
    const data = await prisma.itens_checklist.findMany({
      orderBy: { nome_item: "asc" },
    });

    return serializePrisma(data);
  },
};