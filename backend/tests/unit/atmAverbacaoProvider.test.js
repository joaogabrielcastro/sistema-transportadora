import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.FISCAL_HTTP_TIMEOUT_MS = "2000";

const {
  ATM_HOMOLOG_BASE_URL,
  ATM_PRODUCTION_BASE_URL,
  AtmAverbacaoProvider,
  atmBaseUrl,
  parseAtmAuthToken,
} = await import("../../src/services/averbacao/providers/AtmAverbacaoProvider.js");
const { createAverbacaoProvider } = await import(
  "../../src/services/averbacao/createAverbacaoProvider.js"
);
const { AverbacaoProvider } = await import(
  "../../src/services/averbacao/AverbacaoProvider.js"
);

function cred(ambiente = "homologacao") {
  return {
    usuario: "teste",
    senha: "teste",
    codigoAtm: "11000000",
    ambiente,
  };
}

describe("AtmAverbacaoProvider", () => {
  const originalFetch = globalThis.fetch;
  let calls;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/Auth")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ Bearer: "tok-atm" }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            Averbado: {
              Protocolo: "PROT-1",
              dhAverbacao: "2026-09-06T10:00:00",
              DadosSeguro: [{ NumeroAverbacao: "AV-1" }],
            },
          }),
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("homologação e produção usam hosts oficiais distintos", () => {
    assert.equal(atmBaseUrl("homologacao"), ATM_HOMOLOG_BASE_URL);
    assert.equal(atmBaseUrl("producao"), ATM_PRODUCTION_BASE_URL);
    assert.notEqual(ATM_HOMOLOG_BASE_URL, ATM_PRODUCTION_BASE_URL);
    assert.match(ATM_HOMOLOG_BASE_URL, /homologaws\.averba\.com\.br/);
    assert.match(ATM_PRODUCTION_BASE_URL, /webserver\.averba\.com\.br/);
    assert.equal(ATM_HOMOLOG_BASE_URL.includes("webserver"), false);
  });

  it("parseia token Bearer da Auth oficial", () => {
    assert.equal(parseAtmAuthToken({ Bearer: "abc" }), "abc");
    assert.equal(parseAtmAuthToken(JSON.stringify({ Bearer: "xyz" })), "xyz");
  });

  it("testar conexão autentica em /Auth sem logar senha no body das demais calls", async () => {
    const p = new AtmAverbacaoProvider(cred());
    const r = await p.testarConexao();
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /homologaws\.averba\.com\.br\/rest\/Auth$/);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.usuario, "teste");
    assert.equal(body.codigoatm, "11000000");
    assert.equal(body.senha, "teste");
  });

  it("averba CT-e com XML, Bearer e content-type application/xml", async () => {
    const p = new AtmAverbacaoProvider(cred());
    const result = await p.averbar({
      xml: "<cteProc></cteProc>",
      tipoDocumento: "cte",
    });
    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/rest\/Cte$/);
    assert.equal(calls[1].init.headers.Authorization, "Bearer tok-atm");
    assert.equal(calls[1].init.headers["Content-Type"], "application/xml");
    assert.equal(calls[1].init.body, "<cteProc></cteProc>");
    assert.equal(result.response.Averbado.Protocolo, "PROT-1");
  });

  it("declara MDF-e em /MDFe", async () => {
    const p = new AtmAverbacaoProvider(cred());
    await p.averbar({ xml: "<mdfeProc/>", tipoDocumento: "mdfe" });
    assert.match(calls[1].url, /\/rest\/MDFe$/);
  });

  it("produção nunca chama homologaws", async () => {
    const p = new AtmAverbacaoProvider(cred("producao"));
    await p.averbar({ xml: "<cteProc/>", tipoDocumento: "cte" });
    for (const c of calls) {
      assert.equal(c.url.includes("homologaws"), false);
      assert.match(c.url, /webserver\.averba\.com\.br/);
    }
  });

  it("erro de autenticação (401) não envia XML", async () => {
    globalThis.fetch = async (url) => {
      calls.push({ url: String(url) });
      return {
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            Erros: { Erro: [{ Codigo: "904", Descricao: "nao autorizado" }] },
          }),
      };
    };
    const p = new AtmAverbacaoProvider(cred());
    await assert.rejects(() => p.averbar({ xml: "<x/>", tipoDocumento: "cte" }));
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/Auth$/);
  });

  it("timeout na Auth devolve ok=false com timeout", async () => {
    globalThis.fetch = async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    };
    const p = new AtmAverbacaoProvider(cred());
    const r = await p.testarConexao();
    assert.equal(r.ok, false);
    assert.equal(r.timeout, true);
  });

  it("consultar reenvia o XML (não há GET de consulta no manual)", async () => {
    const p = new AtmAverbacaoProvider(cred());
    await p.consultar({ xml: "<cteProc/>", tipoDocumento: "cte" });
    assert.match(calls[1].url, /\/Cte$/);
    assert.equal(calls[1].init.method, "POST");
  });

  it("factory recusa provedor desconhecido e não instancia a classe abstrata", () => {
    assert.throws(() => new AverbacaoProvider(cred()), /abstrato/);
    assert.throws(() => createAverbacaoProvider("ndd", cred()), /não está implementado/);
    const p = createAverbacaoProvider("atm", cred());
    assert.ok(p instanceof AtmAverbacaoProvider);
  });

  it("credenciais incompletas falham na Auth", async () => {
    const p = new AtmAverbacaoProvider({
      usuario: "",
      senha: "",
      codigoAtm: "",
      ambiente: "homologacao",
    });
    await assert.rejects(() => p.autenticar(), /incompletas/);
  });
});
