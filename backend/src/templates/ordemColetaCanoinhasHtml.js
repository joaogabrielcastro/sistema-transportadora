import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** HTML do template compacto. O valor de API `tipo` continua `CANOINHAS` por compatibilidade com envios já gravados. */
export const ORDEM_COLETA_CANOINHAS_HTML = readFileSync(
  path.join(__dirname, "html", "autorizacao_coleta_compacta.html"),
  "utf8",
);
