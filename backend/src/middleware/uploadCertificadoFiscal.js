import multer from "multer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const pfxFilter = (_req, file, cb) => {
  const ext = String(file.originalname || "")
    .toLowerCase()
    .split(".")
    .pop();
  const mime = String(file.mimetype || "").toLowerCase();
  const extOk = ext === "pfx" || ext === "p12";
  const mimeOk =
    mime === "application/x-pkcs12" ||
    mime === "application/pkcs12" ||
    mime === "application/octet-stream" ||
    mime === "";
  if (extOk && mimeOk) {
    cb(null, true);
    return;
  }
  cb(new Error("Envie um certificado A1 (.pfx ou .p12)."));
};

export const uploadCertificadoFiscal = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: pfxFilter,
}).single("certificado");

export const handleCertificadoMulterError = (err, req, res, next) => {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "O certificado pode ter no máximo 5 MB.",
    });
  }
  return res.status(400).json({
    success: false,
    error: err.message || "Falha no upload do certificado.",
  });
};
