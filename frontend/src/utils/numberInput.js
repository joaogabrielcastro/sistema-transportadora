/**
 * Helpers para inputs numéricos com pontuação pt-BR.
 * Display: 598.245 ou 1.234,56
 * Valor emitido no onChange: string "crua" para parseInt/parseFloat (598245 / 1234.56)
 */

/**
 * Quantidade de casas decimais a partir de `step` HTML.
 * @param {string|number|undefined|null} step
 * @returns {number|null} null = inteiro
 */
export function decimalsFromStep(step) {
  if (step == null || step === "") return null;
  if (step === "any") return 6;
  const n = Number(step);
  if (!Number.isFinite(n) || n <= 0 || Number.isInteger(n)) return null;
  const s = String(step);
  const dot = s.indexOf(".");
  if (dot === -1) return null;
  return Math.min(6, s.length - dot - 1);
}

/**
 * Converte texto digitado (com pontuação BR) no valor cru do formulário.
 * @param {string} input
 * @param {{ maxDecimals?: number|null }} [opts]
 * @returns {string} "" | dígitos | "1234.56" | "1234."
 */
export function parseNumberInputValue(input, opts = {}) {
  const maxDecimals = opts.maxDecimals ?? null;
  if (input == null) return "";

  const raw = String(input).trim();
  if (!raw) return "";

  const allowDecimal = maxDecimals != null;
  const neg = raw.startsWith("-");
  let body = neg ? raw.slice(1) : raw;

  if (!allowDecimal) {
    const digits = body.replace(/\D/g, "");
    if (!digits) return "";
    const normalized = String(BigInt(digits)); // preserva inteiros grandes sem notação científica
    return neg ? `-${normalized}` : normalized;
  }

  // Aceita ponto ou vírgula como decimal; pontos de milhar são removidos
  // Estratégia: último separador ("," ou ".") com dígitos depois = decimal
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  const decIdx = Math.max(lastComma, lastDot);

  let intDigits;
  let fracDigits = "";
  let hasDecSep = false;

  if (decIdx === -1) {
    intDigits = body.replace(/\D/g, "");
  } else {
    // Se o separador está no final ou parece decimal (poucos dígitos após)
    const after = body.slice(decIdx + 1).replace(/\D/g, "");
    const before = body.slice(0, decIdx).replace(/\D/g, "");
    // Milhar BR: ponto com exatamente 3 dígitos depois e mais pontos antes → trata como milhar
    const isThousandDot =
      body[decIdx] === "." &&
      after.length === 3 &&
      !body.slice(decIdx + 1).includes(",") &&
      lastComma === -1 &&
      body.indexOf(".") !== lastDot;

    if (isThousandDot) {
      intDigits = body.replace(/\D/g, "");
    } else {
      hasDecSep = true;
      intDigits = before;
      fracDigits = after.slice(0, maxDecimals);
    }
  }

  if (!intDigits && !hasDecSep) return "";
  if (!intDigits) intDigits = "0";

  // Remove zeros à esquerda
  intDigits = String(BigInt(intDigits || "0"));

  let out = intDigits;
  if (hasDecSep) {
    out += `.${fracDigits}`;
  }
  if (neg && out !== "0" && out !== "0.") {
    out = `-${out}`;
  }
  return out;
}

/**
 * Formata valor numérico (ou string crua) para exibição pt-BR.
 * @param {string|number|null|undefined} value
 * @param {{ maxDecimals?: number|null }} [opts]
 */
export function formatNumberInputDisplay(value, opts = {}) {
  const maxDecimals = opts.maxDecimals ?? null;
  if (value === null || value === undefined || value === "") return "";

  const raw = String(value).trim();
  if (!raw) return "";
  if (raw === "-") return "-";

  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const trailingDec = /[.,]$/.test(body);
  const allowDecimal = maxDecimals != null;

  if (!allowDecimal) {
    const digits = body.replace(/\D/g, "");
    if (!digits) return neg ? "-" : "";
    const formatted = new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(BigInt(digits));
    return neg ? `-${formatted}` : formatted;
  }

  const cleaned = body.replace(",", ".");
  const parts = cleaned.split(".");
  const intDigits = (parts[0] || "").replace(/\D/g, "") || (parts.length > 1 ? "0" : "");
  const fracDigits = (parts[1] || "").replace(/\D/g, "").slice(0, maxDecimals);
  const hasFracPart = parts.length > 1;

  if (!intDigits && !hasFracPart) return neg ? "-" : "";

  const intFormatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(BigInt(intDigits || "0"));

  let out = neg ? `-${intFormatted}` : intFormatted;
  if (hasFracPart) {
    out += `,${fracDigits}`;
    if (trailingDec && fracDigits === "") {
      // já tem vírgula
    }
  }
  return out;
}
