// frontend/src/utils/formatters.js

/**
 * Formatar data no padrão brasileiro (dd/MM/yyyy).
 * Campos DATE do Postgres chegam como meia-noite UTC — usa o calendário UTC
 * para não “voltar” um dia em America/Sao_Paulo.
 */
export const formatDate = (date, options = {}) => {
  if (!date) return "";

  const wantsTime =
    options.hour != null ||
    options.minute != null ||
    options.second != null;

  if (!wantsTime && typeof date === "string") {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]}`;
    }
  }

  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return "";
  }

  if (!wantsTime) {
    const isDateOnlyUtcMidnight =
      dateObj.getUTCHours() === 0 &&
      dateObj.getUTCMinutes() === 0 &&
      dateObj.getUTCSeconds() === 0;
    if (isDateOnlyUtcMidnight) {
      const d = String(dateObj.getUTCDate()).padStart(2, "0");
      const mo = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const y = dateObj.getUTCFullYear();
      return `${d}/${mo}/${y}`;
    }
  }

  const defaultOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  };

  return dateObj.toLocaleDateString("pt-BR", { ...defaultOptions, ...options });
};

/**
 * Formatar data e hora no padrão brasileiro
 */
export const formatDateTime = (date) => {
  return formatDate(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Formatar moeda brasileira
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formatar número com separadores de milhares
 */
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || isNaN(value)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Intervalo ISO (YYYY-MM-DD) dos últimos N meses, até a data de referência.
 * Usado no dashboard e nos relatórios — calendário local, sem inventar períodos.
 */
export function lastMonthsIsoRange(months = 6, now = new Date()) {
  const n = Number(months);
  const count = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 6;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end.getFullYear(), end.getMonth() - (count - 1), 1);
  const toIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { startDate: toIso(start), endDate: toIso(end) };
}
