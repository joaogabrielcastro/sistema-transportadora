// backend/src/middleware/validation.js
import { z } from "zod";
import { logger } from "../utils/logger.js";

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
        errors: error.errors,
      });

      return res.status(400).json({
        error: "Dados inválidos",
        details: error.errors?.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })) || [{ message: error.message }],
      });
    }
  };
};

export const handleValidationError = (error, req, res, next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }
  next(error);
};
