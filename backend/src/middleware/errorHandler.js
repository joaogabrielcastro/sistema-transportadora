// backend/src/middleware/errorHandler.js
import { logger } from "../utils/logger.js";
import prismaClientPkg from "@prisma/client";
import { ZodError } from "zod";

const { Prisma } = prismaClientPkg;

export const errorHandler = (err, req, res, _next) => {
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
      success: false,
      error: "Erro de validação nos dados enviados",
      details: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    });
  }

  // Erro de validação customizado
  if (err.code === "DEPENDENCIES_EXIST") {
    return res.status(409).json({
      success: false,
      error: err.message,
      type: "RELATED_RECORDS_EXIST",
      code: "DEPENDENCIES_EXIST",
      dependencies: err.dependencies,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "Registro duplicado para um campo único.",
        code: err.code,
        target: err.meta?.target,
      });
    }

    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        error: "Operação inválida por causa de relacionamento entre registros.",
        code: err.code,
        field: err.meta?.field_name,
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Registro não encontrado.",
        code: err.code,
      });
    }
  }

  // Erro de recurso não encontrado
  if (err.message === "Caminhão não encontrado") {
    return res.status(404).json({
      success: false,
      error: err.message,
    });
  }

  // Erro de validação de entrada
  if (
    err.message.includes("já está em uso") ||
    err.message.includes("deve ter pelo menos")
  ) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Erro genérico do servidor
  res.status(500).json({
    success: false,
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
    success: false,
    error: "Rota não encontrada",
  });
};
