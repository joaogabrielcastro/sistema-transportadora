import test from "node:test";
import assert from "node:assert/strict";
import { declararCiotSchema } from "../../src/schemas/fiscalSchema.js";
import { colunasRntrcSnapshot } from "../../src/services/fiscal/CiotService.js";

/**
 * CIOT — snapshot da situação do RNTRC do contratado (item 3.1). Sem consulta
 * automática à ANTT: só grava o que vier no corpo. Funções puras — sem banco.
 */

const baseCiot = {
  fiscal_empresa_id: 1,
  tipo_operacao: 3,
  cpf_cnpj_contratado: "12345678000199",
  rntrc_contratado: "123456789",
  cpf_cnpj_contratante: "99999999000191",
  valor_frete: 1000,
  valor_piso_minimo_frete: 900,
  valor_vale_pedagio: 0,
  data_declaracao: "2026-09-02T10:00:00-03:00",
  data_inicio_viagem: "2026-09-03T08:00:00-03:00",
  data_fim_viagem: "2026-09-05T18:00:00-03:00",
  veiculos: [
    { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 3 },
    { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 2 },
  ],
  inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
};

test("schema aceita situacao + snapshot do RNTRC do contratado", () => {
  const ok = declararCiotSchema.parse({
    ...baseCiot,
    rntrc_contratado_situacao: "ativo",
    rntrc_contratado_snapshot: { consultadoEm: "2026-09-02", situacao: "ATIVO" },
  });
  assert.equal(ok.rntrc_contratado_situacao, "ativo");
  assert.equal(ok.rntrc_contratado_snapshot.situacao, "ATIVO");
});

test("schema continua válido sem os campos novos (compatível pra trás)", () => {
  assert.doesNotThrow(() => declararCiotSchema.parse(baseCiot));
});

test("colunasRntrcSnapshot: sem dados -> tudo null e sem chave de snapshot", () => {
  const cols = colunasRntrcSnapshot({});
  assert.equal(cols.rntrc_contratado_situacao, null);
  assert.equal(cols.rntrc_contratado_situacao_em, null);
  assert.equal("rntrc_contratado_snapshot" in cols, false);
});

test("colunasRntrcSnapshot: com situacao -> carimba a data e mantém a string", () => {
  const cols = colunasRntrcSnapshot({ rntrc_contratado_situacao: "suspenso" });
  assert.equal(cols.rntrc_contratado_situacao, "suspenso");
  assert.ok(cols.rntrc_contratado_situacao_em instanceof Date);
});

test("colunasRntrcSnapshot: só inclui a chave JSONB quando há snapshot", () => {
  const cols = colunasRntrcSnapshot({ rntrc_contratado_snapshot: { a: 1 } });
  assert.deepEqual(cols.rntrc_contratado_snapshot, { a: 1 });
  assert.ok(cols.rntrc_contratado_situacao_em instanceof Date);
});
