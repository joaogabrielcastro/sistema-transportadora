/**
 * Substitui placeholders {{chave}} no HTML. Valores são escapados para texto seguro no documento.
 */
export const escapeHtml = (value) => {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const mergeTemplate = (html, vars) => {
  if (typeof html !== "string") return "";
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return "";
    return escapeHtml(vars[key]);
  });
};
