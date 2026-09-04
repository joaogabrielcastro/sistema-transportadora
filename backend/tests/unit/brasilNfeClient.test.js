import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.BRASIL_NFE_BASE_URL = "https://api.brasilnfe.com.br/services";
process.env.BRASIL_NFE_USER_TOKEN = "user-token-test";
process.env.FISCAL_HTTP_TIMEOUT_MS = "5000";

const {
  brasilNfeBaseUrl,
  BrasilNFeClient,
  joinBrasilNfeUrl,
} = await import("../../src/services/fiscal/brasilNfe/BrasilNFeClient.js");

describe("BrasilNFeClient", () => {
  const originalFetch = globalThis.fetch;
  let calls;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 0, chave: "35".padEnd(44, "0") }),
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("usa a URL oficial e não duplica /fiscal", () => {
    assert.equal(brasilNfeBaseUrl(), "https://api.brasilnfe.com.br/services");
    assert.equal(
      joinBrasilNfeUrl(
        "https://api.brasilnfe.com.br/services",
        "/fiscal/EnviarConhecimentoTransporte",
      ),
      "https://api.brasilnfe.com.br/services/fiscal/EnviarConhecimentoTransporte",
    );
    assert.equal(
      joinBrasilNfeUrl(
        "https://legacy.example/fiscal",
        "/fiscal/EnviarConhecimentoTransporte",
      ),
      "https://legacy.example/fiscal/EnviarConhecimentoTransporte",
    );
  });

  it("envia CT-e com header Token e sem logar o token no body", async () => {
    await BrasilNFeClient.enviarConhecimentoTransporte(
      { IdentificadorInterno: "cte-1" },
      "empresa-token",
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /EnviarConhecimentoTransporte$/);
    assert.equal(calls[0].init.headers.Token, "empresa-token");
    assert.equal(calls[0].init.headers.UserToken, "user-token-test");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.IdentificadorInterno, "cte-1");
    assert.equal(body.Token, undefined);
  });

  it("envia MDF-e no endpoint oficial", async () => {
    await BrasilNFeClient.enviarManifestoTransporte({ chave: "x" }, "tok");
    assert.match(calls[0].url, /EnviarManifestoTransporte$/);
  });

  it("cancela CT-e/MDF-e em CancelarNotaFiscal", async () => {
    await BrasilNFeClient.cancelarNotaFiscal({ ChaveNF: "35" }, "tok");
    assert.match(calls[0].url, /CancelarNotaFiscal$/);
  });

  it("encerra MDF-e em EncerrarManifestoTransporte", async () => {
    await BrasilNFeClient.encerrarManifestoTransporte({ chave: "58" }, "tok");
    assert.match(calls[0].url, /EncerrarManifestoTransporte$/);
  });

  it("consulta XML em ObterArquivoNotaFiscal", async () => {
    await BrasilNFeClient.obterArquivoNotaFiscal(
      { ChaveNF: "35", FileType: 1, TipoDocumentoFiscal: 1 },
      "tok",
    );
    assert.match(calls[0].url, /ObterArquivoNotaFiscal$/);
  });

  it("consulta lista em ObterNotasFiscais", async () => {
    await BrasilNFeClient.obterNotasFiscais(
      { TipoDocumentoFiscal: 1, IdentificadorInterno: "cte-1" },
      "tok",
    );
    assert.match(calls[0].url, /ObterNotasFiscais$/);
  });

  it("exige Token da empresa nas rotas /fiscal", async () => {
    await assert.rejects(
      () => BrasilNFeClient.enviarConhecimentoTransporte({}, ""),
      /sem token/i,
    );
    assert.equal(calls.length, 0);
  });

  it("certificado exige UserToken", async () => {
    const prev = process.env.BRASIL_NFE_USER_TOKEN;
    process.env.BRASIL_NFE_USER_TOKEN = "";
    try {
      await assert.rejects(
        () =>
          BrasilNFeClient.alterarCertificado(
            { Senha: "x", Base64CertificateFile: "Y" },
            { token: "tok", userToken: "" },
          ),
        /UserToken/i,
      );
    } finally {
      process.env.BRASIL_NFE_USER_TOKEN = prev;
    }
  });
});
