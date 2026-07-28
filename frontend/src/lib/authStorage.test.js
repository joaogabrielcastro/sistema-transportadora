import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  getAuthHeaderToken,
} from "../lib/authStorage.js";

const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
});

test("authStorage grava e limpa token/user", () => {
  assert.equal(getStoredToken(), "");
  assert.equal(getStoredUser(), null);

  setStoredAuth({
    token: "jwt.token",
    user: { id: 1, email: "a@b.com", tenantId: 1 },
  });

  assert.equal(getStoredToken(), "jwt.token");
  assert.equal(getAuthHeaderToken(), "jwt.token");
  assert.equal(getStoredUser().tenantId, 1);

  clearStoredAuth();
  assert.equal(getStoredToken(), "");
  assert.equal(getStoredUser(), null);
});

test("getStoredUser retorna null para JSON inválido", () => {
  store.set("atrack_auth_user", "{broken");
  assert.equal(getStoredUser(), null);
});

test("authStorage migra chaves legadas abrotto_*", () => {
  store.set("abrotto_auth_token", "legacy.jwt");
  store.set(
    "abrotto_auth_user",
    JSON.stringify({ id: 2, email: "old@test.com" }),
  );
  assert.equal(getStoredToken(), "legacy.jwt");
  assert.equal(getStoredUser().email, "old@test.com");
  assert.equal(store.has("abrotto_auth_token"), false);
});
