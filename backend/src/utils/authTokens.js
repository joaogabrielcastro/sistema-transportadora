import { createHash, randomBytes } from "node:crypto";

export const AUTH_TOKEN_PURPOSE = Object.freeze({
  RESET: "password_reset",
  INVITE: "invite",
});

export const AUTH_TOKEN_TTL = Object.freeze({
  RESET_MS: 60 * 60 * 1000,
  INVITE_MS: 7 * 24 * 60 * 60 * 1000,
});

export function hashAuthToken(raw) {
  return createHash("sha256").update(String(raw || ""), "utf8").digest("hex");
}

export function generateAuthToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashAuthToken(raw) };
}

export function isAuthTokenUsable(row, purpose, now = new Date()) {
  if (!row || row.purpose !== purpose) return false;
  if (row.used_at) return false;
  const expires = row.expires_at instanceof Date
    ? row.expires_at
    : new Date(row.expires_at);
  return expires.getTime() > now.getTime();
}
