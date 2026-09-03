import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveInternalRedirect,
  resolvePostLoginRedirect,
} from "./safeRedirect.js";

describe("resolveInternalRedirect", () => {
  it("aceita caminhos internos", () => {
    assert.equal(resolveInternalRedirect("/relatorios"), "/relatorios");
    assert.equal(
      resolveInternalRedirect("/caminhao/ABC1D23?tab=docs"),
      "/caminhao/ABC1D23?tab=docs",
    );
  });

  it("bloqueia open redirect", () => {
    assert.equal(resolveInternalRedirect("https://evil.test"), "/");
    assert.equal(resolveInternalRedirect("//evil.test"), "/");
    assert.equal(resolveInternalRedirect("\\evil.test"), "/");
    assert.equal(resolveInternalRedirect("/login"), "/");
    assert.equal(resolveInternalRedirect("/register"), "/");
  });
});

describe("resolvePostLoginRedirect", () => {
  it("prioriza state.from do React Router", () => {
    assert.equal(
      resolvePostLoginRedirect({
        search: "?next=/relatorios",
        state: { from: "/usuarios" },
      }),
      "/usuarios",
    );
  });

  it("usa ?next= do interceptor 401", () => {
    assert.equal(
      resolvePostLoginRedirect({ search: "?next=%2Fmanutencao-gastos" }),
      "/manutencao-gastos",
    );
  });
});
