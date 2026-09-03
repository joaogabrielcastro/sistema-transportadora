import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import { normalizarDocumentosCte } from "../../src/services/fiscal/CteService.js";

/**
 * infDoc do CT-e (item 1.2): documentos transportados. Schema + normalização.
 * Funções puras — sem banco.
 */

const CHAVE_44 = "35240000000000000000000000000000000000000000";
const baseCte = {
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  servico: { valor_prestacao: 100 },
  tomador: { cpf_cnpj: "12345678000199" },
};

test("documento tipo 'nfe' sem chave é rejeitado", () => {
  assert.throws(() =>
    emitirCteSchema.parse({ ...baseCte, documentos: [{ tipo: "nfe" }] }),
  );
});

test("documento 'nfe' com chave válida passa", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    documentos: [{ tipo: "nfe", chave: CHAVE_44 }],
  });
  assert.equal(ok.documentos[0].chave, CHAVE_44);
});

test("misturar 'nfe' e 'nf' no mesmo CT-e é rejeitado", () => {
  assert.throws(() =>
    emitirCteSchema.parse({
      ...baseCte,
      documentos: [
        { tipo: "nfe", chave: CHAVE_44 },
        { tipo: "nf", numero: "123", serie: "1" },
      ],
    }),
  );
});

test("normalizarDocumentosCte funde chave_nfe_referenciada como 1 doc 'nfe'", () => {
  const docs = normalizarDocumentosCte({ chave_nfe_referenciada: CHAVE_44 });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].tipo, "nfe");
  assert.equal(docs[0].chave_acesso, CHAVE_44);
});

test("normalizarDocumentosCte concatena legado + documentos[]", () => {
  const docs = normalizarDocumentosCte({
    chave_nfe_referenciada: CHAVE_44,
    documentos: [{ tipo: "outros", numero: "OC-9" }],
  });
  assert.equal(docs.length, 2);
});

test("normalizarDocumentosCte sem nenhum documento lança 400", () => {
  assert.throws(() => normalizarDocumentosCte({}), (err) => {
    assert.equal(err.statusCode, 400);
    return true;
  });
});
