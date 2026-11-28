import multer from "multer";
import path from "node:path";

/** Comprovante de despesa de viagem: um arquivo PDF ou imagem, até 10 MB. */
export const COMPROVANTE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Map([
  [".pdf", ["application/pdf", "application/x-pdf"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]],
  [".webp", ["image/webp"]],
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  const mimes = ALLOWED.get(ext);
  if (mimes && (mimes.includes(mime) || mime === "application/octet-stream" || mime === "")) {
    cb(null, true);
    return;
  }
  const err = new Error("Comprovante deve ser PDF, JPG, PNG ou WEBP.");
  err.statusCode = 400;
  cb(err);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COMPROVANTE_MAX_BYTES, files: 1 },
  fileFilter,
}).single("comprovante");

/** Aceita JSON ou multipart/form-data com o campo `comprovante`. */
export function uploadComprovante(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  return upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, error: "O comprovante pode ter no máximo 10 MB." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ success: false, error: "Envie um único arquivo no campo comprovante." });
    }
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  });
}
