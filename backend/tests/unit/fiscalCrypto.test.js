import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.FISCAL_SECRETS_KEY =
  process.env.FISCAL_SECRETS_KEY || "unit-test-fiscal-secrets-key";

const { encryptSecret, decryptSecret, isEncryptedSecret, secretIsSet } =
  await import("../../src/utils/fiscalCrypto.js");

describe("fiscalCrypto", () => {
  it("roundtrip: decrypt(encrypt(x)) === x", () => {
    const secret = "cte-mdfe-provider-token-abc123";
    const enc = encryptSecret(secret);
    assert.notEqual(enc, secret);
    assert.ok(isEncryptedSecret(enc));
    assert.equal(decryptSecret(enc), secret);
  });

  it("cada cifra usa IV novo (saída diferente para mesmo texto)", () => {
    assert.notEqual(encryptSecret("igual"), encryptSecret("igual"));
  });

  it("entrada vazia -> null", () => {
    assert.equal(encryptSecret(""), null);
    assert.equal(encryptSecret(null), null);
    assert.equal(decryptSecret(null), null);
  });

  it("texto adulterado falha ao decifrar (GCM auth tag)", () => {
    const enc = encryptSecret("valor");
    const parts = enc.split(":");
    const ct = Buffer.from(parts[3], "base64");
    ct[0] ^= 0xff;
    parts[3] = ct.toString("base64");
    assert.throws(() => decryptSecret(parts.join(":")));
  });

  it("formato não-cifrado é rejeitado no decrypt", () => {
    assert.throws(() => decryptSecret("texto-puro"));
  });

  it("sem FISCAL_SECRETS_KEY: encrypt lança 503", async () => {
    const prev = process.env.FISCAL_SECRETS_KEY;
    delete process.env.FISCAL_SECRETS_KEY;
    try {
      const err = (() => {
        try {
          encryptSecret("x");
          return null;
        } catch (e) {
          return e;
        }
      })();
      assert.ok(err);
      assert.equal(err.statusCode, 503);
    } finally {
      process.env.FISCAL_SECRETS_KEY = prev;
    }
  });

  it("chave hex de 64 chars é aceita como 32 bytes crus", () => {
    const prev = process.env.FISCAL_SECRETS_KEY;
    process.env.FISCAL_SECRETS_KEY = "a".repeat(64);
    try {
      assert.equal(decryptSecret(encryptSecret("oi")), "oi");
    } finally {
      process.env.FISCAL_SECRETS_KEY = prev;
    }
  });

  it("secretIsSet", () => {
    assert.equal(secretIsSet(null), false);
    assert.equal(secretIsSet(""), false);
    assert.equal(secretIsSet("x"), true);
  });
});
