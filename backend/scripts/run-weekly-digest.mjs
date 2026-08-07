#!/usr/bin/env node
/**
 * Dispara digest semanal (e-mail + WhatsApp) para todos os tenants elegíveis.
 * Agende via cron: 0 8 * * 1  (segunda 8h)
 *
 *   node scripts/run-weekly-digest.mjs
 */
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
import "dotenv/config";
import { DigestService } from "../src/services/DigestService.js";
import prisma from "../src/lib/prisma.js";

const results = await DigestService.runWeeklyDigestJob();
console.log(JSON.stringify(results, null, 2));
await prisma.$disconnect();
