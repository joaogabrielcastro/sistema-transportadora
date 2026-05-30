// backend/src/middleware/validation.js
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { getZodIssues } from "../utils/zodIssues.js";

export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validationData = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      schema.parse(validationData);
      next();
    } catch (error) {
      logger.warn("Validation failed", {
        path: req.path,
        method: req.method,
        issues: getZodIssues(error),
      });

      const issues = getZodIssues(error);
      return res.status(400).json({
        success: false,
        error: "Dados inválidos",
        details: issues.length
          ? issues.map((issue) => ({
              field: Array.isArray(issue.path) ? issue.path.join(".") : "",
              message: issue.message,
            }))
          : [{ message: error.message }],
      });
    }
  };
};

export const handleValidationError = (error, req, res, next) => {
  if (error instanceof z.ZodError) {
    const issues = getZodIssues(error);
    return res.status(400).json({
      success: false,
      error: "Dados inválidos",
      details: issues.map((issue) => ({
        field: Array.isArray(issue.path) ? issue.path.join(".") : "",
        message: issue.message,
      })),
    });
  }
  next(error);
};
