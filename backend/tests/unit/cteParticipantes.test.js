import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  normalizarParticipantesCte,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * CT-e — rem / dest / exped / receb separados + ide.toma (item 1.2). Schema,
 * normalização para fiscal_cte_participantes e montagem do payload. Funções
 * puras — sem banco.
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

test("schema aceita remetente/destinatario tipados com endereco e ainda chaves extras", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    toma: 3,
    remetente: {
      cnpj_cpf: "11.222.333/0001-44",
      razao_social: "Origem LTDA",
      endereco: { uf: "SP", codigo_municipio: "3550308", cep: "01001-000" },
      campoLivreDoProvedor: "mantido",
    },
    destinatario: { razao_social: "Destino SA", endereco: { uf: "MG" } },
  });
  assert.equal(ok.toma, 3);
  // digits() normaliza o CNPJ
  assert.equal(ok.remetente.cnpj_cpf, "11222333000144");
  assert.equal(ok.remetente.endereco.cep, "01001000");
  assert.equal(ok.remetente.campoLivreDoProvedor, "mantido");
});

test("schema rejeita toma fora de 0..4", () => {
  assert.throws(() => emitirCteSchema.parse({ ...baseCte, toma: 5 }));
});

test("payload atual sem participantes continua válido (compatível pra trás)", () => {
  const ok = emitirCteSchema.parse(baseCte);
  assert.equal(ok.remetente, undefined);
  assert.equal(ok.toma, undefined);
});

test("normalizarParticipantesCte achata endereco e ignora papéis ausentes", () => {
  const dto = {
    remetente: {
      razao_social: "Origem LTDA",
      cnpj_cpf: "11222333000144",
      endereco: { uf: "SP", nome_municipio: "São Paulo" },
    },
    recebedor: { razao_social: "Quem recebe" },
  };
  const linhas = normalizarParticipantesCte(dto);
  assert.equal(linhas.length, 2);
  const rem = linhas.find((l) => l.papel === "rem");
  assert.equal(rem.razao_social, "Origem LTDA");
  assert.equal(rem.uf, "SP");
  assert.equal(rem.nome_municipio, "São Paulo");
  assert.equal(rem.numero, null);
  assert.ok(linhas.some((l) => l.papel === "receb"));
  assert.ok(!linhas.some((l) => l.papel === "dest" || l.papel === "exped"));
});

test("montarPayloadCte expõe Toma e Recebedor além dos grupos já existentes", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    toma: 2,
    recebedor: { razao_social: "Quem recebe" },
    remetente: { razao_social: "Origem" },
  });
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.equal(payload.Toma, 2);
  assert.equal(payload.Recebedor.razao_social, "Quem recebe");
  assert.equal(payload.Remetente.razao_social, "Origem");
});

test("montarPayloadCte sem toma/recebedor não injeta as chaves", () => {
  const dto = emitirCteSchema.parse(baseCte);
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.equal(payload.Toma, undefined);
  assert.equal(payload.Recebedor, undefined);
});
