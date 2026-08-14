import { z } from "zod";
import { dataStringSchema } from "./shared.js";

const nomeItemSchema = z
  .string()
  .trim()
  .min(1, "Informe o item de manutenção")
  .max(255)
  .optional()
  .nullable();

function parseDataParts(value) {
  const v = String(value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return { y: Number(br[3]), m: Number(br[2]), d: Number(br[1]) };
  return null;
}

function isNotFutureDate(value) {
  const parts = parseDataParts(value);
  if (!parts) return false;
  const today = new Date();
  const todayNum =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  const valueNum = parts.y * 10000 + parts.m * 100 + parts.d;
  return valueNum <= todayNum;
}

export const checklistSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  item_id: z.coerce.number().int().positive().optional().nullable(),
  /** Texto livre: backend faz find-or-create em itens_checklist */
  nome_item: nomeItemSchema,
  data_manutencao: dataStringSchema.refine(isNotFutureDate, {
    message: "A data da manutenção não pode ser futura.",
  }),
  km_manutencao: z.coerce.number().int().positive().optional().nullable(),
  km_registro: z.coerce.number().int().positive().optional().nullable(),
  valor: z.coerce.number().nonnegative().optional().nullable(),
  observacao: z.string().optional().nullable(),
  oficina: z.string().optional().nullable(),
  /** KM da próxima troca / manutenção (lembrete). */
  proxima_km: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().int().positive().optional().nullable(),
  ),
  /** Data da próxima troca / manutenção (lembrete; pode ser futura). */
  proxima_data: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    dataStringSchema.optional().nullable(),
  ),
  produto_id: z.coerce.number().int().positive().optional().nullable(),
  quantidade_estoque: z.coerce.number().positive().optional().nullable(),
});

export const checklistUpdateSchema = checklistSchema.partial();
