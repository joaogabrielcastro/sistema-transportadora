import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_UNAVAILABLE_MESSAGE,
  PUBLIC_PLAN_LIDS,
  isValidPublicLid,
  normalizeLid,
  persistSelectedLid,
  planCtaHref,
  planosHref,
  registerHref,
  resolveSelectedLid,
} from "./planLid.js";

describe("planLid", () => {
  beforeEach(() => {
    globalThis.sessionStorage = (() => {
      const store = new Map();
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
    })();
  });

  it("plano correto gera LID correto", () => {
    assert.deepEqual([...PUBLIC_PLAN_LIDS], ["starter", "fiscal", "complete"]);
    assert.equal(normalizeLid(" FISCAL "), "fiscal");
    assert.equal(isValidPublicLid("starter"), true);
    assert.equal(registerHref("fiscal"), "/register?lid=fiscal");
    assert.equal(planosHref("complete"), "/planos/complete");
  });

  it("plano inexistente é rejeitado sem quebrar o fluxo", () => {
    const result = resolveSelectedLid({ searchLid: "profissional" });
    assert.equal(result.lid, null);
    assert.equal(result.invalid, true);
    assert.equal(result.message, PLAN_UNAVAILABLE_MESSAGE);
  });

  it("plano legado ops é rejeitado", () => {
    assert.equal(isValidPublicLid("ops"), false);
    const result = resolveSelectedLid({ pathLid: "ops" });
    assert.equal(result.invalid, true);
  });

  it("LID válido é preservado no refresh via sessionStorage", () => {
    persistSelectedLid("complete");
    const again = resolveSelectedLid({});
    assert.equal(again.lid, "complete");
    assert.equal(again.invalid, false);
  });

  it("registerHref não grava LID só por calcular a URL", () => {
    registerHref("fiscal");
    const stored = resolveSelectedLid({});
    assert.equal(stored.lid, null);
  });

  it("CTA autenticado vai para assinatura com o mesmo LID", () => {
    assert.equal(
      planCtaHref({ lid: "starter", isAuthenticated: true }),
      "/assinatura?lid=starter",
    );
    assert.equal(
      planCtaHref({ lid: "fiscal", isAuthenticated: false, registerEnabled: true }),
      "/register?lid=fiscal",
    );
  });
});
