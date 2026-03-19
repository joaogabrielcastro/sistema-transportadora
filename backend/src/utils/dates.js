export function toPrismaDateTime(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return value;

  const v = value.trim();

  // dd/MM/yyyy
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  }

  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00.000Z`);
  }

  // ISO (or other parseable) datetime
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return value;
}

export function normalizeDatesForDb(input) {
  if (!input || typeof input !== "object") return input;
  const out = { ...input };
  for (const key of Object.keys(out)) {
    if (key.toLowerCase().includes("data")) {
      out[key] = toPrismaDateTime(out[key]);
    }
  }
  return out;
}

