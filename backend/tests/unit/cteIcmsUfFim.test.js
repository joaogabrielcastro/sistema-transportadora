import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  validarIcmsUfFimCte,
  montarImpCte,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * CT-e — grupo ICMSUFFim / DIFAL (item 1.3). A exigência só dispara com as três
 * condições juntas: interestadual + tomador não contribuinte + tomador !=
 * remetente. Funções puras — sem banco.
 */

const baseCte = {
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  servico: { valor_prestacao: 100 },
  tomador: { cpf_cnpj: "12345678000199" },
};

const difalCompleto = {
  vbc_uf_fim: 100,
  p_icms_uf_fim: 18,
  v_icms_uf_fim: 18,
  v_icms_uf_ini: 0,
};

test("não interestadual (uf_ini == uf_fim): não exige DIFAL", () => {
  assert.doesNotThrow(() =>
    validarIcmsUfFimCte({ ...baseCte, uf_ini: "SP", uf_fim: "SP", tomador_ind_ie: 9 }),
  );
});

test("uf_ini/uf_fim ausentes: não exige DIFAL", () => {
  assert.doesNotThrow(() =>
    validarIcmsUfFimCte({ ...baseCte, tomador_ind_ie: 9 }),
  );
});

test("interestadual mas tomador contribuinte (ind_ie != 9): não exige DIFAL", () => {
  assert.doesNotThrow(() =>
    validarIcmsUfFimCte({ ...baseCte, uf_ini: "SP", uf_fim: "MG", tomador_ind_ie: 1 }),
  );
});

test("interestadual + não contribuinte + tomador == remetente: não exige DIFAL", () => {
  assert.doesNotThrow(() =>
    validarIcmsUfFimCte({
      ...baseCte,
      uf_ini: "SP",
      uf_fim: "MG",
      tomador_ind_ie: 9,
      tomador: { cpf_cnpj: "12345678000199" },
      remetente: { cnpj_cpf: "12.345.678/0001-99" },
    }),
  );
});

test("três condições juntas sem difal: lança 400", () => {
  assert.throws(
    () =>
      validarIcmsUfFimCte({
        ...baseCte,
        uf_ini: "SP",
        uf_fim: "MG",
        tomador_ind_ie: 9,
        remetente: { cnpj_cpf: "99999999000191" },
      }),
    (err) => {
      assert.equal(err.statusCode, 400);
      return /ICMSUFFim/.test(err.message);
    },
  );
});

test("três condições juntas com difal preenchido: passa", () => {
  assert.doesNotThrow(() =>
    validarIcmsUfFimCte({
      ...baseCte,
      uf_ini: "SP",
      uf_fim: "MG",
      tomador_ind_ie: 9,
      remetente: { cnpj_cpf: "99999999000191" },
      difal: difalCompleto,
    }),
  );
});

test("montarImpCte inclui o grupo Difal quando difal veio, e não mexe no imposto livre senão", () => {
  const semDifal = montarImpCte({ imposto: { ICMS: { CST: "00" } } });
  assert.deepEqual(semDifal, { ICMS: { CST: "00" } });

  const comDifal = montarImpCte({ difal: difalCompleto });
  assert.equal(comDifal.Difal.BaseCalculoUfDestino, 100);
  assert.equal(comDifal.Difal.AliquotaICMSUfDestino, 18);
});

test("schema aceita uf_ini/uf_fim/tomador_ind_ie/difal e payload leva UFIni/UFFim", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    uf_ini: "SP",
    uf_fim: "MG",
    tomador_ind_ie: 9,
    difal: difalCompleto,
  });
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.equal(payload.UFIni, "SP");
  assert.equal(payload.UFFim, "MG");
  assert.equal(payload.Imposto.Difal.ValorICMSUfDestino, 18);
});

test("schema rejeita tomador_ind_ie fora de {1,2,9}", () => {
  assert.throws(() =>
    emitirCteSchema.parse({ ...baseCte, tomador_ind_ie: 3 }),
  );
});
