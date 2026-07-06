import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !password) return false;

  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const derived = await scryptAsync(password, salt, 64);
  const hashBuf = Buffer.from(hashHex, "hex");

  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}
