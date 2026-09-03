import crypto from "node:crypto";
import { config } from "../config/index.js";

/**
 * Cifra de segredos do módulo fiscal (token do provedor de CT-e/MDF-e, senha do certificado A1).
 *
 * AES-256-GCM. A chave vem de FISCAL_SECRETS_KEY:
 *  - 64 hex chars  -> usada como 32 bytes crus;
 *  - qualquer outra string -> derivada por SHA-256 (32 bytes).
 *
 * Formato do texto cifrado gravado no banco: "fsc1:<iv b64>:<tag b64>:<ciphertext b64>".
 * Isso aqui é banco de produção real — nunca gravar token/senha em texto puro.
 */

const PREFIX = "fsc1";

function resolveKey() {
  const raw = config.fiscal.secretsKey;
  if (!raw) {
    const err = new Error(
      "FISCAL_SECRETS_KEY não configurada no servidor — não é possível gravar segredos fiscais (token/senha do certificado).",
    );
    err.statusCode = 503;
    throw err;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/**
 * @param {string | null | undefined} plaintext
 * @returns {string | null} texto cifrado, ou null se entrada vazia
 */
export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === "") {
    return null;
  }
  const key = resolveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * @param {string | null | undefined} payload texto cifrado gerado por encryptSecret
 * @returns {string | null}
 */
export function decryptSecret(payload) {
  if (payload == null || payload === "") {
    return null;
  }
  const parts = String(payload).split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    const err = new Error("Segredo fiscal em formato inválido ou não cifrado.");
    err.statusCode = 500;
    throw err;
  }
  const key = resolveKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    const err = new Error(
      "Falha ao decifrar segredo fiscal — FISCAL_SECRETS_KEY mudou ou o dado foi corrompido.",
    );
    err.statusCode = 500;
    throw err;
  }
}

/** True se a string já está no formato cifrado deste módulo. */
export function isEncryptedSecret(value) {
  return (
    typeof value === "string" && value.startsWith(`${PREFIX}:`) && value.split(":").length === 4
  );
}

/** Marca de que existe um segredo, sem revelar o valor (para respostas de API). */
export function secretIsSet(value) {
  return value != null && value !== "";
}
