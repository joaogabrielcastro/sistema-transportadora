import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AVERBACAO_OPERACAO,
  AVERBACAO_STATUS,
  decidirEnvioAverbacao,
  isAuthFailure,
  isRetryableAverbacaoFailure,
  isRetryableAtmCode,
  mapAtmResponse,
  podeCancelar,
  podeReprocessar,
  publicAverbacao,
  sanitizeForLog,
} from "../../src/services/averbacao/averbacaoStatus.js";

const sucessoCte = {
  Numero: "1",
  Serie: "1",
  Averbado: {
    dhAverbacao: "2026-09-06T10:00:00",
    Protocolo: "ABC123DEF456",
    DadosSeguro: [
      {
        NumeroAverbacao: "AV-999",
        NomeSeguradora: "SEGURADORA X",
        NumApolice: "AP-1",
        CNPJSeguradora: "12345678000195",
      },
    ],
  },
};

const recusa = {
  Erros: {
    Erro: [{ Codigo: "104", Descricao: "Header Accept invalido." }],
  },
};

const retry = {
  Erros: { Erro: [{ Codigo: "000", Descricao: "Erro de sistema" }] },
};

describe("averbacaoStatus", () => {
  it("mapeia averbação bem-sucedida", () => {
    const r = mapAtmResponse({ response: sucessoCte, httpStatus: 200 });
    assert.equal(r.status, AVERBACAO_STATUS.AVERBED);
    assert.equal(r.extracted.protocolo, "ABC123DEF456");
    assert.equal(r.extracted.numeroAverbacao, "AV-999");
    assert.equal(r.retryable, false);
  });

  it("mapeia declaração de MDF-e (Declarado)", () => {
    const r = mapAtmResponse({
      response: {
        Declarado: { Protocolo: "DECL-1", dhChancela: "2026-09-06T11:00:00" },
      },
      httpStatus: 200,
    });
    assert.equal(r.status, AVERBACAO_STATUS.AVERBED);
    assert.equal(r.extracted.protocolo, "DECL-1");
    assert.equal(r.extracted.declarado, true);
  });

  it("mapeia rejeição de consistência (não retry)", () => {
    const r = mapAtmResponse({ response: recusa, httpStatus: 400 });
    assert.equal(r.status, AVERBACAO_STATUS.REJECTED);
    assert.equal(r.retryable, false);
    assert.equal(r.errorCode, "104");
  });

  it("mapeia erro 000 como retryable", () => {
    const r = mapAtmResponse({ response: retry, httpStatus: 500 });
    assert.equal(r.status, AVERBACAO_STATUS.ERROR);
    assert.equal(r.retryable, true);
    assert.ok(isRetryableAtmCode("000"));
    assert.ok(isRetryableAtmCode("907"));
    assert.ok(isRetryableAtmCode("910"));
    assert.ok(isRetryableAtmCode(""));
  });

  it("timeout e rede são retryable", () => {
    const t = mapAtmResponse({ timeout: true });
    assert.equal(t.status, AVERBACAO_STATUS.ERROR);
    assert.equal(t.retryable, true);
    assert.equal(t.errorCode, "timeout");
    const n = mapAtmResponse({ network: true });
    assert.equal(n.errorCode, "network");
    assert.ok(isRetryableAverbacaoFailure({ timeout: true }));
  });

  it("erro de autenticação não é retry de consistência", () => {
    assert.ok(isAuthFailure({ httpStatus: 401 }));
    assert.ok(isAuthFailure({ errorCode: "904" }));
    assert.ok(isAuthFailure({ errorCode: "915" }));
    const r = mapAtmResponse({
      response: {
        Erros: { Erro: [{ Codigo: "904", Descricao: "não autorizado" }] },
      },
      httpStatus: 401,
    });
    assert.equal(r.status, AVERBACAO_STATUS.ERROR);
    assert.equal(r.retryable, false);
  });

  it("documento já cadastrado com protocolo vira sucesso idempotente", () => {
    const r = mapAtmResponse({
      response: {
        ...sucessoCte,
        Erros: {
          Erro: [{ Codigo: "200", Descricao: "Documento já cadastrado" }],
        },
      },
      httpStatus: 400,
    });
    assert.equal(r.status, AVERBACAO_STATUS.AVERBED);
    assert.equal(r.extracted.protocolo, "ABC123DEF456");
  });

  it("cancelamento sem erros vira cancelled", () => {
    const r = mapAtmResponse({
      response: { Averbado: { Protocolo: "ABC123DEF456" } },
      httpStatus: 200,
      operacao: AVERBACAO_OPERACAO.CANCELAR,
    });
    assert.equal(r.status, AVERBACAO_STATUS.CANCELLED);
  });

  it("idempotência: averbado e em voo não reenviam", () => {
    assert.equal(
      decidirEnvioAverbacao({ status: "averbed" }).action,
      "skip_already_averbed",
    );
    assert.equal(
      decidirEnvioAverbacao({
        status: "processing",
        atualizado_em: new Date(),
      }).action,
      "skip_in_flight",
    );
    assert.equal(
      decidirEnvioAverbacao({ status: "rejected" }).action,
      "skip_rejected",
    );
    assert.equal(decidirEnvioAverbacao({ status: "error" }).action, "send");
    assert.equal(decidirEnvioAverbacao({ status: "pending" }).action, "send");
    assert.equal(decidirEnvioAverbacao(null).action, "create");
  });

  it("processing antigo (stale) pode reenviar", () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    assert.equal(
      decidirEnvioAverbacao({
        status: "processing",
        atualizado_em: old,
      }).action,
      "send",
    );
  });

  it("reprocessar só em error/pending/rejected; cancelar só averbado", () => {
    assert.equal(podeReprocessar({ status: "error" }), true);
    assert.equal(podeReprocessar({ status: "averbed" }), false);
    assert.equal(podeCancelar({ status: "averbed" }), true);
    assert.equal(podeCancelar({ status: "pending" }), false);
  });

  it("sanitizeForLog redige senha/token/usuario e não vaza Bearer", () => {
    const out = sanitizeForLog({
      usuario: "joao",
      senha: "segredo",
      Authorization: "Bearer abc.def",
      token: "xyz",
      protocolo: "OK-1",
    });
    assert.equal(out.usuario, "[redacted]");
    assert.equal(out.senha, "[redacted]");
    assert.equal(out.Authorization, "[redacted]");
    assert.equal(out.token, "[redacted]");
    assert.equal(out.protocolo, "OK-1");
    const dumped = JSON.stringify(out);
    assert.equal(dumped.includes("segredo"), false);
    assert.equal(dumped.includes("abc.def"), false);
  });

  it("publicAverbacao não inclui request_meta/response_data brutos demais nem credenciais", () => {
    const pub = publicAverbacao({
      id: 1,
      tenant_id: 9,
      status: "averbed",
      protocolo: "P1",
      senha: "nao-deve-aparecer",
      request_meta: { xml_sha256: "aa" },
      response_data: { foo: 1 },
    });
    assert.equal(pub.protocolo, "P1");
    assert.equal(pub.request_meta, undefined);
    assert.equal(pub.response_data, undefined);
    assert.equal(pub.senha, undefined);
  });
});
