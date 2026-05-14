import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Ordem de coleta ABROTTO (layout com logo, QR SVG e rodapé). Fonte: `html/ordem_abrotto_svg_nativo.html`. */
export const ORDEM_COLETA_PADRAO_HTML = readFileSync(
  path.join(__dirname, "html", "ordem_abrotto_svg_nativo.html"),
  "utf8",
);
