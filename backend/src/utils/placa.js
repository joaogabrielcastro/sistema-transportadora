/** Normaliza placa brasileira: maiúsculas, sem hífen. */
export const normalizePlaca = (value) => {
  if (value == null || value === "") return null;
  const s = String(value).trim().toUpperCase().replace(/-/g, "");
  return s || null;
};

export const samePlaca = (a, b) => {
  const na = normalizePlaca(a);
  const nb = normalizePlaca(b);
  if (!na || !nb) return false;
  return na === nb;
};
