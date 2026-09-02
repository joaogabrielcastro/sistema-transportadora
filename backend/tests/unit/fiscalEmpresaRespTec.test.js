import test from "node:test";
import assert from "node:assert/strict";
import { fiscalEmpresaSchema } from "../../src/schemas/fiscalSchema.js";
import { toPublicEmpresa } from "../../src/services/fiscal/FiscalEmpresaService.js";
import {
  montarInfRespTec,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * infRespTec (item 1.4): dados do responsável técnico na empresa fiscal,
 * repassados no payload do CT-e. Sem bloqueio de emissão por ausência. Funções
 * puras — sem banco.
 */

test("fiscalEmpresaSchema aceita resp_tec_* opcionais e normaliza o CNPJ", () => {
  const ok = fiscalEmpresaSchema.parse({
    cnpj: "11.222.333/0001-44",
    razao_social: "Emitente LTDA",
    resp_tec_cnpj: "99.888.777/0001-66",
    resp_tec_contato: "TI",
    resp_tec_email: "ti@emitente.com",
    resp_tec_id_csrt: "01",
    resp_tec_csrt: "SEGREDO-CSRT",
  });
  assert.equal(ok.resp_tec_cnpj, "99888777000166");
  assert.equal(ok.resp_tec_csrt, "SEGREDO-CSRT");
});

test("toPublicEmpresa nunca devolve resp_tec_csrt cru, só o booleano *_set", () => {
  const pub = toPublicEmpresa({
    id: 1,
    cnpj: "11222333000144",
    resp_tec_csrt: "fsc1:aaa:bbb:ccc",
    cte_mdfe_provider_token: null,
    certificado_senha: null,
  });
  assert.equal(pub.resp_tec_csrt, undefined);
  assert.equal(pub.resp_tec_csrt_set, true);

  const pubSem = toPublicEmpresa({ id: 2, cnpj: "x", resp_tec_csrt: null });
  assert.equal(pubSem.resp_tec_csrt_set, false);
});

test("montarInfRespTec: undefined sem empresa ou sem CNPJ do resp. técnico", () => {
  assert.equal(montarInfRespTec(undefined), undefined);
  assert.equal(montarInfRespTec({ id: 1 }), undefined);
});

test("montarInfRespTec monta o grupo com CSRT já decifrado", () => {
  const info = montarInfRespTec({
    resp_tec_cnpj: "99888777000166",
    resp_tec_contato: "TI",
    resp_tec_email: "ti@emitente.com",
    resp_tec_fone: "1130001000",
    resp_tec_id_csrt: "01",
    resp_tec_csrt: "SEGREDO-ABERTO",
  });
  assert.equal(info.CNPJ, "99888777000166");
  assert.equal(info.xContato, "TI");
  assert.equal(info.idCSRT, "01");
  assert.equal(info.CSRT, "SEGREDO-ABERTO");
});

test("montarPayloadCte inclui infRespTec quando a empresa tem, e omite quando não tem", () => {
  const dto = emitirCteSchema.parse({
    cliente_id: 1,
    tipo_cte: "0",
    cfop: "6353",
    natureza_operacao: "Transporte",
    dt_emissao: "2026-02-01T10:00:00-03:00",
    servico: { valor_prestacao: 100 },
    tomador: { cpf_cnpj: "12345678000199" },
  });
  const comInfo = montarPayloadCte(dto, undefined, {
    id: 1,
    resp_tec_cnpj: "99888777000166",
  });
  assert.equal(comInfo.infRespTec.CNPJ, "99888777000166");

  const semInfo = montarPayloadCte(dto, undefined, { id: 1 });
  assert.equal(semInfo.infRespTec, undefined);
});
