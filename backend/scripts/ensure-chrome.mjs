import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChromeExecutable } from "../src/utils/resolveChromeExecutable.js";

if (resolveChromeExecutable()) {
  process.exit(0);
}

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || path.join(rootDir, ".cache", "puppeteer");

console.log("[ensure-chrome] Chrome não encontrado; instalando em", cacheDir);

fs.mkdirSync(cacheDir, { recursive: true });

execSync("npx puppeteer browsers install chrome", {
  stdio: "inherit",
  env: {
    ...process.env,
    PUPPETEER_CACHE_DIR: cacheDir,
    PUPPETEER_SKIP_DOWNLOAD: "false",
  },
});

const resolved = resolveChromeExecutable();
if (!resolved) {
  console.error("[ensure-chrome] Falha: Chrome ainda não encontrado após install.");
  process.exit(1);
}

console.log("[ensure-chrome] OK:", resolved);
