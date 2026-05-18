import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const backendRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const UPLOADS_ROOT = path.join(backendRoot, "uploads");
export const CAMINHAO_DOCS_ROOT = path.join(UPLOADS_ROOT, "caminhoes");

export const ensureUploadDirs = () => {
  fs.mkdirSync(CAMINHAO_DOCS_ROOT, { recursive: true });
};

export const caminhaoDocsDir = (caminhaoId) =>
  path.join(CAMINHAO_DOCS_ROOT, String(caminhaoId));
