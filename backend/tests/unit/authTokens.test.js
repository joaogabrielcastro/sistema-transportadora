import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_TOKEN_PURPOSE,
  generateAuthToken,
  hashAuthToken,
  isAuthTokenUsable,
} from "../../src/utils/authTokens.js";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInviteSchema,
  changePasswordSchema,
} from "../../src/schemas/authSchema.js";
import { inviteUserSchema } from "../../src/schemas/userSchema.js";

test("generateAuthToken produz hash SHA-256 estável", () => {
  const { raw, hash } = generateAuthToken();
  assert.equal(hash.length, 64);
  assert.equal(hashAuthToken(raw), hash);
  assert.notEqual(raw, hash);
});

test("isAuthTokenUsable rejeita usado, expirado ou purpose errado", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  const base = {
    purpose: AUTH_TOKEN_PURPOSE.RESET,
    used_at: null,
    expires_at: future,
  };
  assert.equal(isAuthTokenUsable(base, AUTH_TOKEN_PURPOSE.RESET), true);
  assert.equal(isAuthTokenUsable(base, AUTH_TOKEN_PURPOSE.INVITE), false);
  assert.equal(
    isAuthTokenUsable({ ...base, used_at: new Date() }, AUTH_TOKEN_PURPOSE.RESET),
    false,
  );
  assert.equal(
    isAuthTokenUsable({ ...base, expires_at: past }, AUTH_TOKEN_PURPOSE.RESET),
    false,
  );
  assert.equal(isAuthTokenUsable(null, AUTH_TOKEN_PURPOSE.RESET), false);
});

test("forgotPasswordSchema valida e-mail", () => {
  assert.equal(
    forgotPasswordSchema.parse({ email: "  a@b.com " }).email,
    "a@b.com",
  );
  assert.throws(() => forgotPasswordSchema.parse({ email: "x" }));
});

test("resetPasswordSchema exige token e senha forte", () => {
  assert.throws(() =>
    resetPasswordSchema.parse({ token: "abc", password: "12345678" }),
  );
  const ok = resetPasswordSchema.parse({
    token: "a".repeat(20),
    password: "SenhaForte1",
  });
  assert.equal(ok.password, "SenhaForte1");
});

test("acceptInviteSchema e changePasswordSchema", () => {
  assert.throws(() =>
    acceptInviteSchema.parse({
      token: "b".repeat(20),
      password: "SenhaForte1",
    }),
  );
  const invite = acceptInviteSchema.parse({
    token: "b".repeat(20),
    password: "SenhaForte1",
    acceptedLegal: true,
  });
  assert.equal(invite.token.length, 20);
  assert.throws(() =>
    changePasswordSchema.parse({ currentPassword: "", newPassword: "12345678" }),
  );
  const change = changePasswordSchema.parse({
    currentPassword: "antiga",
    newPassword: "NovaSenha1",
  });
  assert.equal(change.newPassword, "NovaSenha1");
});

test("inviteUserSchema não exige senha", () => {
  const invite = inviteUserSchema.parse({
    email: "op@empresa.com",
    nome: "Operador",
    role: "viewer",
  });
  assert.equal(invite.role, "viewer");
  assert.equal("password" in invite, false);
});
