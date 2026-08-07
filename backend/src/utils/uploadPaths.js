import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const backendRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const defaultUploadsRoot = path.join(backendRoot, "uploads");

/** Em produção (Coolify): monte volume em /app/uploads e opcionalmente UPLOADS_DIR=/app/uploads */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : defaultUploadsRoot;

export const CAMINHAO_DOCS_ROOT = path.join(UPLOADS_ROOT, "caminhoes");
export const NOTAS_ROOT = path.join(UPLOADS_ROOT, "notas");

export const ensureUploadDirs = () => {
  fs.mkdirSync(CAMINHAO_DOCS_ROOT, { recursive: true });
  fs.mkdirSync(NOTAS_ROOT, { recursive: true });
};

export const caminhaoDocsDir = (caminhaoId) =>
  path.join(CAMINHAO_DOCS_ROOT, String(caminhaoId));

export const notaDocsDir = (tenantId, notaId) =>
  path.join(NOTAS_ROOT, String(tenantId), String(notaId));
