/** Limite máximo de itens em listagens não paginadas ou por recurso. */
export const MAX_LIST_LIMIT = 200;

export function parseListLimit(raw, defaultLimit = MAX_LIST_LIMIT) {
  const parsed = parseInt(raw, 10);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, limit));
}
