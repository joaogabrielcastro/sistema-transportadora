import { z } from "zod";

const OWNERSHIP = z.enum(["ATRACK", "CUSTOMER"]);
const PROTOCOL = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .optional()
  .nullable();

export const createTelemetryDeviceBodySchema = z
  .object({
    external_id: z.string().trim().min(1).max(64),
    nome: z.string().trim().min(1).max(120).optional().nullable(),
    manufacturer: z.string().trim().min(1).max(64).optional().nullable(),
    model: z.string().trim().min(1).max(64).optional().nullable(),
    imei: z.string().trim().min(1).max(32).optional().nullable(),
    protocol: PROTOCOL,
    connection_type: z.string().trim().min(1).max(32).optional().nullable(),
    ownership_type: OWNERSHIP.optional().nullable(),
    /** Se omitido, o servidor gera e devolve uma única vez. */
    credential: z.string().trim().min(16).max(256).optional(),
    caminhao_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const updateTelemetryDeviceBodySchema = z
  .object({
    nome: z.string().trim().min(1).max(120).optional().nullable(),
    manufacturer: z.string().trim().min(1).max(64).optional().nullable(),
    model: z.string().trim().min(1).max(64).optional().nullable(),
    imei: z.string().trim().min(1).max(32).optional().nullable(),
    protocol: PROTOCOL,
    connection_type: z.string().trim().min(1).max(32).optional().nullable(),
    ownership_type: OWNERSHIP.optional().nullable(),
    ativo: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const assignTelemetryDeviceBodySchema = z
  .object({
    caminhao_id: z.coerce.number().int().positive(),
    inicio_em: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const rotateCredentialBodySchema = z
  .object({
    credential: z.string().trim().min(16).max(256).optional(),
  })
  .strict();

export const telemetryHistoryQuerySchema = z.object({
  caminhao_id: z.coerce.number().int().positive(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
});

export const telemetryCurrentQuerySchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional(),
});

export const geofenceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    shape: z.enum(["circle", "polygon"]),
    geometry: z.record(z.string(), z.any()),
    enabled: z.boolean().optional(),
    caminhao_ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .strict();

export const geofenceUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    shape: z.enum(["circle", "polygon"]).optional(),
    geometry: z.record(z.string(), z.any()).optional(),
    enabled: z.boolean().optional(),
    caminhao_ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Informe ao menos um campo.",
  });

export const alertRuleBodySchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    alert_type: z.string().trim().min(1).max(32),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.any()).optional(),
    caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  })
  .strict();

export const subscriptionBodySchema = z
  .object({
    plan: z.enum(["basic", "advanced"]),
    seat_limit: z.coerce.number().int().min(0).max(10_000),
    monthly_price: z.coerce.number().finite().optional().nullable(),
    stripe_price_id: z.string().trim().max(255).optional().nullable(),
  })
  .strict();

export const efficiencyQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
