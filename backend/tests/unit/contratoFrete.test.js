import test from "node:test";
import assert from "node:assert/strict";
import {
  CIOT_STATUS,
  CONTRATO_STATUS,
  ciotEstaRegistrado,
  ciotNumero,
  isStatusCiot,
  isStatusContrato,
  normalizarStatusCiot,
  serializeContrato,
} from "../../src/services/fiscal/ciotOperacao.js";

test("status do contrato e do CIOT são conjuntos distintos", () => {
  assert.equal(isStatusContrato(CONTRATO_STATUS.ATIVO), true);
  assert.equal(isStatusContrato(CONTRATO_STATUS.EM_ANDAMENTO), true);
  assert.equal(isStatusContrato("registrado"), false);
  assert.equal(isStatusCiot(CIOT_STATUS.REGISTRADO), true);
  assert.equal(isStatusCiot("declarado"), true);
  assert.equal(isStatusCiot(CONTRATO_STATUS.ATIVO), false);
  assert.equal(normalizarStatusCiot("declarado"), CIOT_STATUS.REGISTRADO);
  assert.equal(normalizarStatusCiot("pendente"), CIOT_STATUS.REGISTRANDO);
});

test("serializeContrato não mistura status do contrato com o do CIOT", () => {
  const contrato = {
    id: 12,
    status: CONTRATO_STATUS.EM_ANDAMENTO,
    valor_frete: 2500,
    criado_em: new Date("2026-09-01T12:00:00Z"),
  };
  const ciot = {
    id: 99,
    contrato_frete_id: 12,
    status: CIOT_STATUS.REGISTRADO,
    codigo_identificacao_operacao: "123456789012",
    provider: "antt",
    id_operacao_transporte: "ABCDEF123456",
    protocolo: "P1",
  };
  const out = serializeContrato(contrato, ciot);
  assert.equal(out.status, CONTRATO_STATUS.EM_ANDAMENTO);
  assert.equal(out.ciot.status, CIOT_STATUS.REGISTRADO);
  assert.equal(out.ciot.numero, "123456789012");
  assert.equal(out.codigo_identificacao_operacao, "123456789012");
  assert.notEqual(out.status, out.ciot.status);
  assert.notEqual(String(out.id), out.ciot.numero);
});

test("contrato sem CIOT serializa ciot_status como nao_registrado", () => {
  const out = serializeContrato(
    { id: 1, status: CONTRATO_STATUS.ATIVO, valor_frete: 10 },
    null,
  );
  assert.equal(out.ciot, null);
  assert.equal(out.ciot_status, CIOT_STATUS.NAO_REGISTRADO);
  assert.equal(out.codigo_identificacao_operacao, null);
});

test("ciotEstaRegistrado exige status e número", () => {
  assert.equal(ciotEstaRegistrado(null), false);
  assert.equal(
    ciotEstaRegistrado({ status: CIOT_STATUS.REGISTRADO }),
    false,
  );
  assert.equal(
    ciotEstaRegistrado({
      status: CIOT_STATUS.ERRO,
      codigo_identificacao_operacao: "123",
    }),
    false,
  );
  assert.equal(
    ciotEstaRegistrado({
      status: CIOT_STATUS.REGISTRADO,
      codigo_identificacao_operacao: "123456789",
    }),
    true,
  );
  assert.equal(ciotNumero({ codigo_identificacao_operacao: "12.3" }), "123");
});

test("cancelar contrato e cancelar CIOT são status independentes", () => {
  const contrato = {
    id: 1,
    status: CONTRATO_STATUS.ATIVO,
    valor_frete: 100,
  };
  const ciotCancelado = {
    status: CIOT_STATUS.CANCELADO,
    codigo_identificacao_operacao: "999",
  };
  const out = serializeContrato(contrato, ciotCancelado);
  assert.equal(out.status, CONTRATO_STATUS.ATIVO);
  assert.equal(out.ciot.status, CIOT_STATUS.CANCELADO);
});
