/**
 * Situação de validade da CNH para exibição. Usa a mesma janela de aviso do
 * backend (AlertsService: CNH_WARN_DAYS = 30) — não altera regra de negócio.
 */
export const CNH_WARN_DAYS = 30;

function toDateOnly(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** @returns {{ key: "sem_validade"|"vencida"|"a_vencer"|"valida", days: number|null, label: string }} */
export function cnhStatus(validade, now = new Date()) {
  const date = toDateOnly(validade);
  if (!date) return { key: "sem_validade", days: null, label: "Sem validade" };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date - today) / 86_400_000);
  if (days < 0) {
    return { key: "vencida", days, label: `Vencida há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}` };
  }
  if (days <= CNH_WARN_DAYS) {
    return {
      key: "a_vencer",
      days,
      label: days === 0 ? "Vence hoje" : `Vence em ${days} dia${days === 1 ? "" : "s"}`,
    };
  }
  return { key: "valida", days, label: "Válida" };
}
