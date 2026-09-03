import test from "node:test";
import assert from "node:assert/strict";
import {
  exigeGruposAntt,
  assertSeguroMdfe,
  validarInfAnttMdfe,
  validarProdPredMdfe,
  calcularTotMdfe,
  montarPayloadMdfe,
} from "../../src/services/fiscal/MdfeService.js";
import { emitirMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * MDF-e — grupos seg (2.1), infANTT (2.2), tot (2.3), prodPred (2.4) e ide /
 * infMunCarrega (2.5). Funções puras — sem banco. Cobre também a preservação
 * do payload do caminho "frota própria que já funcionava".
 */

const baseDto = () =>
  emitirMdfeSchema.parse({
    data_emissao: "2026-09-01T12:00:00-03:00",
    uf_carregamento: "SP",
    uf_descarregamento: "MG",
    rodoviario: {},
  });

test("exigeGruposAntt: só tipo_emitente explícito 1 ou 3", () => {
  assert.equal(exigeGruposAntt({ tipo_emitente: 1 }), true);
  assert.equal(exigeGruposAntt({ tipo_emitente: 3 }), true);
  assert.equal(exigeGruposAntt({ tipo_emitente: 2 }), false);
  // ausente NÃO exige (não quebra frota própria sem RNTRC que já emitia)
  assert.equal(exigeGruposAntt({}), false);
});

test("seg (2.1): sem resp_seg e sem seguros[] -> lança; com um deles -> ok", () => {
  assert.throws(() => assertSeguroMdfe({}), /seguro/i);
  assert.doesNotThrow(() => assertSeguroMdfe({ resp_seg: 1 }));
  assert.doesNotThrow(() =>
    assertSeguroMdfe({ seguros: [{ indicadorResponsavel: 1 }] }),
  );
});

test("infANTT (2.2): frota própria (2) e tipo_emitente ausente dispensam RNTRC", () => {
  assert.doesNotThrow(() => validarInfAnttMdfe({ tipo_emitente: 2 }, {}));
  // ausente + empresa sem RNTRC: continua emitindo (caminho frota própria antigo)
  assert.doesNotThrow(() => validarInfAnttMdfe({}, {}));
});

test("infANTT (2.2): prestador (1/3) sem RNTRC lança; com RNTRC da empresa ou do DTO ok", () => {
  assert.throws(
    () => validarInfAnttMdfe({ tipo_emitente: 1 }, {}),
    /RNTRC/,
  );
  assert.throws(
    () => validarInfAnttMdfe({ tipo_emitente: 3 }, {}),
    /RNTRC/,
  );
  assert.doesNotThrow(() =>
    validarInfAnttMdfe({ tipo_emitente: 1 }, { rntrc: "123456789" }),
  );
  assert.doesNotThrow(() =>
    validarInfAnttMdfe(
      { tipo_emitente: 3, inf_antt: { rntrc: "123456789" } },
      {},
    ),
  );
});

test("prodPred (2.4): mesmo critério do infANTT", () => {
  assert.doesNotThrow(() => validarProdPredMdfe({ tipo_emitente: 2 }));
  assert.doesNotThrow(() => validarProdPredMdfe({}));
  assert.throws(() => validarProdPredMdfe({ tipo_emitente: 1 }), /prodPred/);
  assert.doesNotThrow(() =>
    validarProdPredMdfe({ tipo_emitente: 1, prod_pred: { descricao: "Soja" } }),
  );
});

test("tot (2.3): soma valor_frete dos CT-e vinculados", () => {
  const tot = calcularTotMdfe([
    { valor_frete: 1500 },
    { valor_frete: 2500.5 },
  ]);
  assert.equal(tot.qCTe, 2);
  assert.equal(tot.vCarga, 4000.5);
});

test("montarPayloadMdfe sem tot: valor/peso seguem o DTO (frota própria intacta)", () => {
  const dto = baseDto();
  dto.valor = 9999;
  dto.peso = 12000;
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.valor, 9999);
  assert.equal(payload.peso, 12000);
  assert.equal(payload.infANTT, undefined);
  assert.equal(payload.tot, undefined);
});

test("montarPayloadMdfe com tot: totais calculados têm precedência", () => {
  const payload = montarPayloadMdfe(baseDto(), "ABC1D23", [], [], [], {
    qCTe: 2,
    vCarga: 4000.5,
    qCarga: undefined,
  });
  assert.equal(payload.valor, 4000.5);
  assert.equal(payload.tot.qCTe, 2);
});

test("montarPayloadMdfe: infANTT / prodPred / infMunCarrega / ide quando presentes", () => {
  const dto = emitirMdfeSchema.parse({
    data_emissao: "2026-09-01T12:00:00-03:00",
    uf_carregamento: "SP",
    uf_descarregamento: "MG",
    rodoviario: {},
    inf_antt: { rntrc: "123456789", ciot: "999" },
    prod_pred: { descricao: "Soja", ncm: "12019000" },
    municipios_carrega: [{ codigo_municipio: "3550308", nome_municipio: "São Paulo" }],
    ide: { uf_ini: "SP", uf_fim: "MG", tp_transp: 1 },
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.infANTT.RNTRC, "123456789");
  assert.equal(payload.produtoPredominante.xProd, "Soja");
  assert.equal(payload.infMunCarrega[0].cMunCarrega, "3550308");
  assert.equal(payload.ide.UFIni, "SP");
});
