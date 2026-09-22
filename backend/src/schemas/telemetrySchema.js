import { z } from "zod";

/** Teto explícito do contrato. Acima disso o ponto é rejeitado, não cortado. */
export const TELEMETRY_MAX_SPEED_KMH = 300;
export const TELEMETRY_EVENT_ID_MAX = 80;

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const telemetryIngestSchema = z
  .object({
    event_id: z
      .string()
      .trim()
      .min(1, "event_id é obrigatório.")
      .max(TELEMETRY_EVENT_ID_MAX, "event_id excede o tamanho permitido."),
    recorded_at: z
      .string()
      .trim()
      .refine(
        (value) => ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value)),
        "recorded_at deve ser ISO 8601.",
      ),
    latitude: z
      .number()
      .finite()
      .gte(-90, "latitude fora de -90..90.")
      .lte(90, "latitude fora de -90..90."),
    longitude: z
      .number()
      .finite()
      .gte(-180, "longitude fora de -180..180.")
      .lte(180, "longitude fora de -180..180."),
    speed_kmh: z
      .number()
      .finite()
      .gte(0, "speed_kmh não pode ser negativa.")
      .lte(TELEMETRY_MAX_SPEED_KMH, "speed_kmh acima do limite."),
    ignition: z.boolean(),
  })
  .strict();
