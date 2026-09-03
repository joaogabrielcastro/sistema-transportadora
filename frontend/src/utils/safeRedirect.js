const FALLBACK = "/";

/**
 * Only allow in-app relative paths. Blocks open redirects (/login?next=https://…).
 * @param {unknown} candidate
 * @param {string} [fallback]
 */
export function resolveInternalRedirect(candidate, fallback = FALLBACK) {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || /:\/\//.test(trimmed)) return fallback;
  if (trimmed.startsWith("/login") || trimmed.startsWith("/register")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Prefer React Router state.from (in-app Navigate), then ?next= from 401 interceptor.
 * @param {{ search?: string, state?: { from?: unknown } } | null | undefined} location
 */
export function resolvePostLoginRedirect(location) {
  const params = new URLSearchParams(location?.search || "");
  const nextParam = params.get("next");
  const fromState = location?.state?.from;
  const fromStatePath =
    typeof fromState === "string"
      ? fromState
      : fromState && typeof fromState === "object" && "pathname" in fromState
        ? `${fromState.pathname || ""}${fromState.search || ""}`
        : "";
  return resolveInternalRedirect(fromStatePath || nextParam || FALLBACK);
}
