import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarClaimEmissao,
  CTE_STATUS,
  codigoSefaz,
  dadosPersistenciaConsulta,
  deveConsultarProvedor,
  documentoJaEnviadoAoProvedor,
  escolherNotaConsultada,
  identificadorInternoCte,
  identificadorInternoMdfe,
  interpretarNotaConsultada,
  interpretarRespostaCte,
  interpretarRespostaEvento,
  interpretarRespostaMdfe,
  listarNotasConsulta,
  MDFE_STATUS,
  mensagemSefaz,
  montarPayloadObterNotasFiscais,
  prazoCancelamentoExpirado,
  sanitizarRespostaProvedor,
} from "../../src/services/fiscal/fiscalStatus.js";

describe("avaliarClaimEmissao", () => {
  it("autoriza rascunho / rejeitado / erro", () => {
    for (const status of [
      CTE_STATUS.RASCUNHO,
      CTE_STATUS.REJEITADO,
      CTE_STATUS.ERRO,
      CTE_STATUS.PENDENTE,
    ]) {
      assert.equal(avaliarClaimEmissao({ status }).action, "claim");
    }
  });

  it("é idempotente quando já autorizado", () => {
    assert.equal(
      avaliarClaimEmissao({ status: CTE_STATUS.PROCESSADO }).action,
      "already_authorized",
    );
  });

  it("bloqueia cancelado e encerrado", () => {
    assert.equal(
      avaliarClaimEmissao({ status: CTE_STATUS.CANCELADO }).action,
      "reject",
    );
    assert.equal(
      avaliarClaimEmissao({ status: MDFE_STATUS.ENCERRADO }).action,
      "reject",
    );
  });

  it("bloqueia processando dentro da janela de lock", () => {
    const now = Date.now();
    const r = avaliarClaimEmissao(
      { status: CTE_STATUS.PROCESSANDO, emissao_iniciada_em: new Date(now - 10_000) },
      { now },
    );
    assert.equal(r.action, "reject");
    assert.equal(r.error.statusCode, 409);
  });

  it("permite retomar processando após o lock expirar", () => {
    const now = Date.now();
    const r = avaliarClaimEmissao(
      {
        status: CTE_STATUS.PROCESSANDO,
        emissao_iniciada_em: new Date(now - 3 * 60 * 1000),
      },
      { now },
    );
    assert.equal(r.action, "claim");
  });

  it("consulta em vez de reenviar se processando já tem chave ou identificador", () => {
    const now = Date.now();
    assert.equal(
      avaliarClaimEmissao(
        {
          status: CTE_STATUS.PROCESSANDO,
          chave_acesso: "35".padEnd(44, "0"),
          emissao_iniciada_em: new Date(now - 3 * 60 * 1000),
        },
        { now },
      ).action,
      "consult",
    );
    assert.equal(
      avaliarClaimEmissao(
        {
          status: CTE_STATUS.PROCESSANDO,
          brasil_nfe_id: "mdfe-9",
          emissao_iniciada_em: new Date(now - 10_000),
        },
        { now },
      ).action,
      "consult",
    );
  });
});

describe("interpretarRespostaCte", () => {
  it("autoriza quando há chave", () => {
    const r = interpretarRespostaCte({ status: 0, chave: "35".padEnd(44, "0") });
    assert.equal(r.outcome, "authorized");
  });

  it("rejeita com erros da SEFAZ sem chave", () => {
    const r = interpretarRespostaCte({
      status: 2,
      erros: ["Rejeição 204"],
      DsMotivo: "Rejeição 204",
    });
    assert.equal(r.outcome, "rejected");
    assert.match(r.mensagem, /204|rejeit/i);
  });
});

describe("interpretarRespostaMdfe", () => {
  it("processando quando status 2", () => {
    const r = interpretarRespostaMdfe({ status: 2 });
    assert.equal(r.outcome, "processing");
  });

  it("autoriza manifesto com chave", () => {
    const r = interpretarRespostaMdfe({ status: 1, chave: "58".padEnd(44, "1") });
    assert.equal(r.outcome, "authorized");
  });
});

describe("interpretarRespostaEvento", () => {
  it("erro no evento com Status 3", () => {
    assert.equal(interpretarRespostaEvento({ Status: 3 }).outcome, "error");
  });
});

describe("sanitizarRespostaProvedor", () => {
  it("remove xml, certificado, senha e tokens", () => {
    const limpo = sanitizarRespostaProvedor({
      chave: "abc",
      base64Xml: "AAAA",
      Senha: "secret",
      Token: "tok",
      UserToken: "user",
      Base64CertificateFile: "cert",
    });
    assert.equal(limpo.chave, "abc");
    assert.equal(limpo.base64Xml, undefined);
    assert.equal(limpo.Senha, undefined);
    assert.equal(limpo.Token, undefined);
    assert.equal(limpo.UserToken, undefined);
    assert.equal(limpo.Base64CertificateFile, undefined);
  });
});

describe("helpers SEFAZ / prazos", () => {
  it("extrai código e mensagem", () => {
    assert.equal(codigoSefaz({ CodStatusRespostaSefaz: "204" }), 204);
    assert.equal(mensagemSefaz({ DsMotivo: "rejeitado" }), "rejeitado");
  });

  it("prazo de cancelamento de 24h", () => {
    const now = Date.now();
    assert.equal(
      prazoCancelamentoExpirado(new Date(now - 2 * 60 * 60 * 1000), { now }),
      false,
    );
    assert.equal(
      prazoCancelamentoExpirado(new Date(now - 25 * 60 * 60 * 1000), { now }),
      true,
    );
  });

  it("identificadores internos estáveis", () => {
    assert.equal(identificadorInternoCte(12), "cte-12");
    assert.equal(identificadorInternoMdfe(9), "mdfe-9");
  });
});

describe("consulta ObterNotasFiscais", () => {
  it("deveConsultarProvedor só após envio ou processando", () => {
    assert.equal(deveConsultarProvedor({ status: "rascunho" }), false);
    assert.equal(deveConsultarProvedor({ status: "processando" }), true);
    assert.equal(
      deveConsultarProvedor({ status: "rascunho", chave_acesso: "35".padEnd(44, "0") }),
      true,
    );
    assert.equal(documentoJaEnviadoAoProvedor({ brasil_nfe_id: "cte-1" }), true);
  });

  it("montarPayloadObterNotasFiscais usa campos oficiais", () => {
    const agora = new Date("2026-09-04T12:00:00.000Z");
    const payload = montarPayloadObterNotasFiscais({
      identificadorInterno: "cte-12",
      ambiente: 2,
      dataRef: "2026-09-03T10:00:00.000Z",
      agora,
    });
    assert.equal(payload.TipoDocumentoFiscal, 1);
    assert.equal(payload.TipoAmbiente, 2);
    assert.equal(payload.IdentificadorInterno, "cte-12");
    assert.ok(payload.DtInicio);
    assert.ok(payload.DtFim);
  });

  it("escolhe a nota pela chave ou identificador interno", () => {
    const notas = [
      { IdentificadorInterno: "cte-1", chave: "1".repeat(44) },
      { IdentificadorInterno: "cte-12", chave: "2".repeat(44) },
    ];
    assert.equal(
      escolherNotaConsultada(notas, { identificadorInterno: "cte-12" }).chave,
      "2".repeat(44),
    );
    assert.equal(listarNotasConsulta({ Notas: notas }).length, 2);
    assert.equal(listarNotasConsulta(null).length, 0);
  });

  it("interpreta autorizado / rejeitado / cancelado / processando", () => {
    assert.equal(
      interpretarNotaConsultada({ chave: "3".repeat(44), Situacao: "autorizado" })
        .outcome,
      "authorized",
    );
    assert.equal(
      interpretarNotaConsultada({ Situacao: "Rejeição", DsMotivo: "204" }).outcome,
      "rejected",
    );
    assert.equal(
      interpretarNotaConsultada({ Situacao: "Cancelado", chave: "3".repeat(44) })
        .outcome,
      "cancelled",
    );
    assert.equal(
      interpretarNotaConsultada({ status: 2 }).outcome,
      "processing",
    );
    assert.equal(interpretarNotaConsultada(null).outcome, "not_found");
  });

  it("persistência promove processando para autorizado e não reverte encerrado", () => {
    const autorizada = dadosPersistenciaConsulta(
      { outcome: "authorized", chave: "5".repeat(44) },
      { numero: 10, serie: 1, NuProtocolo: "100" },
      { row: { status: "processando" }, identificadorInterno: "mdfe-1" },
    );
    assert.equal(autorizada.status, CTE_STATUS.PROCESSADO);
    assert.equal(autorizada.chave_acesso, "5".repeat(44));
    assert.equal(autorizada.numero_protocolo, "100");
    assert.equal(autorizada.brasil_nfe_id, "mdfe-1");

    const encerrado = dadosPersistenciaConsulta(
      { outcome: "authorized", chave: "5".repeat(44) },
      { chave: "5".repeat(44) },
      { row: { status: MDFE_STATUS.ENCERRADO } },
    );
    assert.equal(encerrado.status, undefined);
  });
});
