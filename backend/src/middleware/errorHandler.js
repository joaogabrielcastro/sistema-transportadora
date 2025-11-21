// backend/src/middleware/errorHandler.js
import { logger } from "../utils/logger.js";
import { ZodError } from "zod";

export const errorHandler = (err, req, res, next) => {
  logger.error("Error occurred", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Erro de validação do Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Erro de validação nos dados enviados",
      details: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    });
  }

  // Erro de validação customizado
  if (err.code === "DEPENDENCIES_EXIST") {
    return res.status(409).json({
      error: err.message,
      type: "RELATED_RECORDS_EXIST",
      code: "DEPENDENCIES_EXIST",
      dependencies: err.dependencies,
    });
  }

  // Erro de recurso não encontrado
  if (err.message === "Caminhão não encontrado") {
    return res.status(404).json({
      error: err.message,
    });
  }

  // Erro de validação de entrada
  if (
    err.message.includes("já está em uso") ||
    err.message.includes("deve ter pelo menos")
  ) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // Erro genérico do servidor
  res.status(500).json({
    error: "Erro interno do servidor",
    message:
      process.env.NODE_ENV === "development" ? err.message : "Algo deu errado",
  });
};

export const notFound = (req, res) => {
  logger.warn("Route not found", {
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    error: "Rota não encontrada",
  });
};
