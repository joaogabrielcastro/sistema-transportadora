import prisma from "../lib/prisma.js";
import { serializePrisma } from "../utils/prismaSerialization.js";

export const statusPneusModel = {
  getAll: async () => {
    const data = await prisma.status_pneus.findMany({
      orderBy: { nome_status: "asc" },
    });

    return serializePrisma(data);
  },
};
