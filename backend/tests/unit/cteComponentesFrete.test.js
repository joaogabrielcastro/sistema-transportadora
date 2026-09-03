import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import { montarServico, montarPayloadCte } from "../../src/services/fiscal/CteService.js";

/**
 * vPrest.Comp do CT-e (item 1.1): componentes do valor da prestação. Schema +
 * montagem do bloco Servico. Funções puras — sem banco. Sem obrigatoriedade
 * nova: a soma dos componentes NÃO é conferida contra valor_prestacao.
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

test("schema aceita servico.componentes com nome e valor", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    servico: {
      valor_prestacao: 100,
      componentes: [
        { nome: "FRETE PESO", valor: 70 },
        { nome: "GRIS", valor: 20 },
        { nome: "PEDAGIO", valor: 10 },
      ],
    },
  });
  assert.equal(ok.servico.componentes.length, 3);
  assert.equal(ok.servico.componentes[1].nome, "GRIS");
});

test("schema rejeita componente sem nome", () => {
  assert.throws(() =>
    emitirCteSchema.parse({
      ...baseCte,
      servico: { valor_prestacao: 100, componentes: [{ valor: 10 }] },
    }),
  );
});

test("schema NÃO exige que a soma dos componentes bata com valor_prestacao", () => {
  assert.doesNotThrow(() =>
    emitirCteSchema.parse({
      ...baseCte,
      servico: {
        valor_prestacao: 100,
        componentes: [{ nome: "FRETE PESO", valor: 5 }],
      },
    }),
  );
});

test("montarServico sem componentes devolve o servico intacto", () => {
  const servico = { valor_prestacao: 100, tpServ: 0 };
  assert.equal(montarServico({ servico }), servico);
  assert.equal(montarServico({}), undefined);
});

test("montarServico traduz componentes para Servico.Componentes (nome completo do provedor) sem perder o resto", () => {
  const out = montarServico({
    servico: {
      valor_prestacao: 100,
      tpServ: 0,
      componentes: [
        { nome: "FRETE PESO", valor: 70 },
        { nome: "OUTROS" },
      ],
    },
  });
  assert.equal(out.valor_prestacao, 100);
  assert.equal(out.tpServ, 0);
  assert.equal(out.componentes, undefined);
  // PARTE 4: o grupo é `Componentes`, não a abreviação `Comp` do XSD da SEFAZ, e
  // as chaves de cada item são as descritivas do provedor (`Nome` / `Valor`),
  // não `xNome` / `vComp` do XSD.
  assert.equal(out.Comp, undefined);
  assert.deepEqual(out.Componentes, [
    { Nome: "FRETE PESO", Valor: 70 },
    { Nome: "OUTROS", Valor: undefined },
  ]);
});

test("montarPayloadCte usa montarServico no bloco Servico", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    servico: {
      valor_prestacao: 100,
      componentes: [{ nome: "GRIS", valor: 20 }],
    },
  });
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.deepEqual(payload.Servico.Componentes, [{ Nome: "GRIS", Valor: 20 }]);
});
