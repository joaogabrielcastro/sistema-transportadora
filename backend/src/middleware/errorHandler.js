// backend/src/middleware/errorHandler.js
import { logger } from "../utils/logger.js";
import prismaClientPkg from "@prisma/client";
import { ZodError } from "zod";

const { Prisma } = prismaClientPkg;

const prismaUniqueFieldLabels = {
  placa: "placa do cavalo",
  placa_carreta_1: "placa da carreta 1",
  placa_carreta_2: "placa da carreta 2",
  numero_carreta_1: "número da carreta 1",
  numero_carreta_2: "número da carreta 2",
  numero_cavalo: "número do cavalo",
};

const formatP2002Message = (meta) => {
  const raw = meta?.target;
  const fields = Array.isArray(raw)
    ? raw
    : raw != null
      ? [String(raw)]
      : [];
  if (fields.length === 0) {
    return "Registro duplicado: já existe outro cadastro com o mesmo valor em um campo único.";
  }
  const labels = fields.map(
    (f) => prismaUniqueFieldLabels[f] || String(f).replace(/_/g, " "),
  );
  return (
    `Registro duplicado: o valor informado já existe em outro caminhão (${labels.join(", ")}). ` +
    `Abra a lista de caminhões, procure por essa placa ou número e ajuste o outro cadastro primeiro.`
  );
};

const friendlyServerMessage = (req) => {
  // Mensagem padrão mais amigável, sem expor detalhes internos
  const action =
    req.method === "POST"
      ? "salvar"
      : req.method === "PUT" || req.method === "PATCH"
        ? "atualizar"
        : req.method === "DELETE"
          ? "excluir"
          : "processar";
  return `Não foi possível ${action} sua solicitação. Tente novamente ou contate o suporte.`;
};

export const errorHandler = (err, req, res, _next) => {
  logger.error("Error occurred", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    // Evitar vazar dados sensíveis em logs
    bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : null,
  });

  // Erro de validação do Zod
  if (err instanceof ZodError && Array.isArray(err.errors)) {
    return res.status(400).json({
      success: false,
      error: "Erro de validação nos dados enviados",
      code: "VALIDATION_ERROR",
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
        error: formatP2002Message(err.meta),
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

    // Fallback para outros códigos do Prisma
    return res.status(400).json({
      success: false,
      error: "Não foi possível concluir a operação no banco de dados.",
      code: err.code,
    });
  }

  // Erro de recurso não encontrado
  if (err.message === "Caminhão não encontrado") {
    return res.status(404).json({
      success: false,
      error: err.message,
    });
  }

  // Regra de negócio: duplicidade de carreta/cavalo entre caminhões
  if (err.code === "DUPLICATE_CAMINHAO_FIELDS") {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: err.code,
      conflicts: err.conflicts ?? null,
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
    error: friendlyServerMessage(req),
    code: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
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
