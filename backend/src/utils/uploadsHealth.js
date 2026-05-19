import fs from "node:fs/promises";
import { CAMINHAO_DOCS_ROOT, UPLOADS_ROOT } from "./uploadPaths.js";

export const getUploadsHealth = async () => {
  const probeFile = `${CAMINHAO_DOCS_ROOT}/.health-write-probe`;
  let writable = false;
  let probeError = null;

  try {
    await fs.mkdir(CAMINHAO_DOCS_ROOT, { recursive: true });
    await fs.writeFile(probeFile, "ok", "utf8");
    await fs.unlink(probeFile);
    writable = true;
  } catch (err) {
    probeError = err.message;
  }

  return {
    uploadsRoot: UPLOADS_ROOT,
    caminhoesRoot: CAMINHAO_DOCS_ROOT,
    writable,
    probeError,
    hint:
      "Monte volume persistente em /app/uploads no Coolify (UPLOADS_DIR=/app/uploads). Sem volume, PDFs somem a cada deploy.",
  };
};
