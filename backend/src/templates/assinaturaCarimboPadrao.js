import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pngBase64 = readFileSync(
  path.join(__dirname, "assets", "assinatura-carimbo-cliente.png"),
).toString("base64");

/** Assinatura + carimbo fixos (PHD) em todos os PDFs de ordem/autorização. */
export const ASSINATURA_CARIMBO_PADRAO_HTML = [
  '<div class="assinatura-carimbo-padrao" style="margin-top: 20px; text-align: center; page-break-inside: avoid;">',
  '  <img',
  `    src="data:image/png;base64,${pngBase64}"`,
  '    alt="Cliente – Nome legível e assinatura; carimbo PHD"',
  '    style="max-width: 340px; width: 78%; height: auto; display: block; margin: 0 auto;"',
  "  />",
  "</div>",
].join("\n");
