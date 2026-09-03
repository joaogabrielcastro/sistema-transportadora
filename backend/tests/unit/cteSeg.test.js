import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import { montarSegCte, montarPayloadCte } from "../../src/services/fiscal/CteService.js";
import { montarGrupoSeguro } from "../../src/services/fiscal/fiscalShared.js";

/**
 * CT-e — grupo seg (item 1.6). Opcional (sem assert de obrigatoriedade, ao
 * contrário do MDF-e). Reaproveita montarGrupoSeguro de fiscalShared.js.
 * Funções puras — sem banco.
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

test("montarGrupoSeguro: compatível com o contrato que o MDF-e já usava", () => {
  assert.equal(montarGrupoSeguro({}), undefined);
  assert.deepEqual(montarGrupoSeguro({ seguros: [{ x: 1 }] }), [{ x: 1 }]);
  assert.deepEqual(
    montarGrupoSeguro({
      resp_seg: 1,
      cnpj_seguradora: "12345678000199",
      numero_apolice: "AP-1",
      numero_averbacao: "AV-1",
    }),
    [
      {
        indicadorResponsavel: 1,
        cnpjSegurador: "12345678000199",
        numeroApolice: "AP-1",
        numerosAverbacao: ["AV-1"],
      },
    ],
  );
});

test("montarSegCte: undefined sem o grupo seg", () => {
  assert.equal(montarSegCte({}), undefined);
});

test("montarSegCte traduz o objeto seg aninhado para o formato do provedor", () => {
  const out = montarSegCte({
    seg: {
      responsavel: 5,
      cnpj_seguradora: "12345678000199",
      numero_apolice: "AP-9",
      numero_averbacao: "AV-9",
      nome_seguradora: "Seguradora X",
    },
  });
  assert.deepEqual(out, [
    {
      indicadorResponsavel: 5,
      cnpjSegurador: "12345678000199",
      numeroApolice: "AP-9",
      numerosAverbacao: ["AV-9"],
    },
  ]);
});

test("schema aceita seg opcional e NÃO exige nada quando ausente", () => {
  assert.doesNotThrow(() => emitirCteSchema.parse(baseCte));
  const ok = emitirCteSchema.parse({
    ...baseCte,
    seg: { responsavel: 5, cnpj_seguradora: "12.345.678/0001-99" },
  });
  assert.equal(ok.seg.cnpj_seguradora, "12345678000199");
});

test("montarPayloadCte expõe Seg quando informado e omite quando não", () => {
  const comSeg = montarPayloadCte(
    emitirCteSchema.parse({ ...baseCte, seg: { responsavel: 5 } }),
    undefined,
    undefined,
  );
  assert.equal(comSeg.Seg[0].indicadorResponsavel, 5);

  const semSeg = montarPayloadCte(emitirCteSchema.parse(baseCte), undefined, undefined);
  assert.equal(semSeg.Seg, undefined);
});
