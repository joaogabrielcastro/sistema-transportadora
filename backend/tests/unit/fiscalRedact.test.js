import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactValue, withLogContext } from "../../src/utils/redact.js";
import { runWithRequestContext } from "../../src/utils/requestContext.js";
import { toPublicEmpresa } from "../../src/services/fiscal/FiscalEmpresaService.js";

describe("redact fiscal", () => {
  it("remove token, senha, pfx e xml aninhados", () => {
    const limpo = redactValue({
      ok: true,
      nested: {
        Token: "super-secret",
        senha: "pfx-pass",
        certificado: { pfx: "AAAA" },
        payload: { UserToken: "ut", base64Xml: "xml" },
      },
    });
    assert.equal(limpo.ok, true);
    assert.equal(limpo.nested.Token, "[redacted]");
    assert.equal(limpo.nested.senha, "[redacted]");
    assert.equal(limpo.nested.certificado, "[redacted]");
    assert.equal(limpo.nested.payload.UserToken, "[redacted]");
    assert.equal(limpo.nested.payload.base64Xml, "[redacted]");
  });

  it("withLogContext inclui requestId e não vaza senha", () => {
    const out = runWithRequestContext({ requestId: "req-1", tenantId: 9 }, () =>
      withLogContext({ senha: "secret", cteId: 12 }),
    );
    assert.equal(out.requestId, "req-1");
    assert.equal(out.tenantId, 9);
    assert.equal(out.senha, "[redacted]");
    assert.equal(out.cteId, 12);
  });

  it("toPublicEmpresa não devolve token nem senha", () => {
    const pub = toPublicEmpresa({
      id: 1,
      cte_mdfe_provider_token: "tok",
      certificado_senha: "secret",
      brasil_nfe_user_token: "ut",
      resp_tec_csrt: "csrt",
      razao_social: "X",
    });
    assert.equal(pub.cte_mdfe_provider_token, undefined);
    assert.equal(pub.certificado_senha, undefined);
    assert.equal(pub.brasil_nfe_user_token, undefined);
    assert.equal(pub.resp_tec_csrt, undefined);
    assert.equal(pub.razao_social, "X");
    assert.equal(pub.cte_mdfe_provider_token_set, true);
    assert.equal(pub.certificado_senha_set, true);
  });
});

describe("redact fiscal", () => {
  it("remove token, senha, pfx e xml aninhados", () => {
    const limpo = redactValue({
      ok: true,
      nested: {
        Token: "super-secret",
        senha: "pfx-pass",
        certificado: { pfx: "AAAA" },
        payload: { UserToken: "ut", base64Xml: "xml" },
      },
    });
    assert.equal(limpo.ok, true);
    assert.equal(limpo.nested.Token, "[redacted]");
    assert.equal(limpo.nested.senha, "[redacted]");
    assert.equal(limpo.nested.certificado, "[redacted]");
    assert.equal(limpo.nested.payload.UserToken, "[redacted]");
    assert.equal(limpo.nested.payload.base64Xml, "[redacted]");
  });

  it("withLogContext inclui requestId e não vaza senha", () => {
    const out = runWithRequestContext({ requestId: "req-1", tenantId: 9 }, () =>
      withLogContext({ senha: "secret", cteId: 12 }),
    );
    assert.equal(out.requestId, "req-1");
    assert.equal(out.tenantId, 9);
    assert.equal(out.senha, "[redacted]");
    assert.equal(out.cteId, 12);
  });
});
