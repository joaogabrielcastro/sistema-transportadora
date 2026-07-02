// backend/src/middleware/errorHandler.js
import { logger } from "../utils/logger.js";
import prismaClientPkg from "@prisma/client";
import { ZodError } from "zod";
import { formatZodIssueLines } from "../utils/zodIssues.js";

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

/** Erros do Nodemailer / Microsoft 365 — mensagem clara para o usuário. */
const resolveSmtpError = (err) => {
  const msg = String(err?.message || err?.response || "");
  const code = err?.code || "";

  if (
    /smtp_auth_disabled|SmtpClientAuthentication is disabled/i.test(msg)
  ) {
    return {
      status: 503,
      error:
        "O Microsoft 365 bloqueou o envio SMTP nesta caixa de e-mail. Um administrador do domínio precisa habilitar “SMTP autenticado” para logistica@abrottotransportes.com.br no centro de administração M365 (Exchange → caixa de correio → autenticação SMTP). Guia: https://aka.ms/smtp_auth_disabled",
      code: "SMTP_AUTH_DISABLED",
    };
  }

  if (
    code === "EAUTH" ||
    /535|Invalid login|Authentication unsuccessful/i.test(msg)
  ) {
    return {
      status: 503,
      error:
        "Falha ao autenticar no servidor de e-mail. Confira SMTP_USER e SMTP_PASS no Coolify (use senha de aplicativo se a conta tiver verificação em duas etapas) e se o SMTP autenticado está habilitado na caixa.",
      code: "SMTP_AUTH_FAILED",
    };
  }

  if (/ECONNECTION|ETIMEDOUT|ESOCKET|getaddrinfo/i.test(msg)) {
    return {
      status: 503,
      error:
        "Não foi possível conectar ao servidor SMTP. Verifique SMTP_HOST e SMTP_PORT (Microsoft 365: smtp.office365.com, porta 587).",
      code: "SMTP_CONNECTION_FAILED",
    };
  }

  return null;
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

  // Erro de validação do Zod (v4: issues; legado: errors)
  if (err instanceof ZodError) {
    const details = formatZodIssueLines(err);
    return res.status(400).json({
      success: false,
      error: "Erro de validação nos dados enviados",
      code: "VALIDATION_ERROR",
      details: details.length ? details : [err.message],
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

    if (
      err.code === "P1000" ||
      /authentication failed/i.test(String(err.message))
    ) {
      return res.status(503).json({
        success: false,
        error:
          "Falha ao autenticar no PostgreSQL. Ajuste DATABASE_URL em backend/.env (usuário e senha corretos) ou suba o banco de desenvolvimento com: npm run db:up",
        code: err.code || "DB_AUTH_FAILED",
      });
    }

    // Fallback para outros códigos do Prisma
    return res.status(503).json({
      success: false,
      error: "Não foi possível concluir a operação no banco de dados.",
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    const msg = String(err.message || "");
    if (/authentication failed/i.test(msg) || err.errorCode === "P1000") {
      return res.status(503).json({
        success: false,
        error:
          "Falha ao conectar no PostgreSQL. Verifique DATABASE_URL em backend/.env ou execute npm run db:up na pasta backend.",
        code: "DB_AUTH_FAILED",
      });
    }
  }

  if (err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: err.message || "Requisição inválida.",
    });
  }

  if (err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      error: err.message || "Não encontrado.",
    });
  }

  if (err.statusCode === 503) {
    return res.status(503).json({
      success: false,
      error: err.message || "Serviço temporariamente indisponível.",
      code: "SERVICE_UNAVAILABLE",
    });
  }

  const msg = String(err.message || "");
  if (/puppeteer|chromium|browser process|Failed to launch/i.test(msg)) {
    return res.status(503).json({
      success: false,
      error:
        "Não foi possível gerar o PDF. Verifique o Chrome do Puppeteer no container (rebuild do Dockerfile) ou rode: npx puppeteer browsers install chrome.",
      code: "PDF_GENERATION_FAILED",
    });
  }

  // Erro de recurso não encontrado
  if (
    err.message === "Caminhão não encontrado" ||
    err.message === "Gasto não encontrado" ||
    err.message === "Item de checklist não encontrado" ||
    err.message === "Pneu não encontrado"
  ) {
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

  const smtp = resolveSmtpError(err);
  if (smtp) {
    return res.status(smtp.status).json({
      success: false,
      error: smtp.error,
      code: smtp.code,
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
