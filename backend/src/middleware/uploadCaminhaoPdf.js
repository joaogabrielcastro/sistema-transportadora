import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { caminhaoDocsDir, ensureUploadDirs } from "../utils/uploadPaths.js";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      ensureUploadDirs();
      const id = req.caminhaoUpload?.id;
      if (!id) {
        return cb(new Error("Caminhão não identificado para upload."));
      }
      const dir = caminhaoDocsDir(id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const safeExt = ext === ".pdf" ? ext : ".pdf";
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

const pdfFilter = (_req, file, cb) => {
  const mimeOk = file.mimetype === "application/pdf";
  const extOk = path.extname(file.originalname).toLowerCase() === ".pdf";
  if (mimeOk || extOk) {
    cb(null, true);
    return;
  }
  cb(new Error("Apenas arquivos PDF são permitidos."));
};

export const uploadCaminhaoPdfs = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter: pdfFilter,
}).array("arquivos", MAX_FILES_PER_REQUEST);

export const handleMulterError = (err, req, res, next) => {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "Cada PDF pode ter no máximo 15 MB.",
    });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      error: `Envie no máximo ${MAX_FILES_PER_REQUEST} arquivos por vez.`,
    });
  }
  return res.status(400).json({
    success: false,
    error: err.message || "Falha no upload do arquivo.",
  });
};
