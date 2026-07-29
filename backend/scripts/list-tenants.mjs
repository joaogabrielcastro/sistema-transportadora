#!/usr/bin/env node
import "dotenv/config";
import prisma from "../src/lib/prisma.js";

const tenants = await prisma.tenants.findMany({
  select: { id: true, slug: true, nome: true },
  orderBy: { id: "asc" },
});
console.log(JSON.stringify(tenants, null, 2));
await prisma.$disconnect();
