import test from "node:test";
import assert from "node:assert/strict";
import { declararCiotSchema } from "../../src/schemas/fiscalSchema.js";
import { verificarPisoMinimoFrete } from "../../src/services/fiscal/CiotService.js";

/**
 * CIOT — mdfe_id opcional (3.2), NCM da carga (3.4), piso mínimo de frete (3.3).
 * Schema + verificação pura de piso — sem banco.
 */

const baseCiot = {
  fiscal_empresa_id: 1,
  tipo_operacao: 3,
  cpf_cnpj_contratado: "12345678000199",
  rntrc_contratado: "123456789",
  cpf_cnpj_contratante: "98765432000199",
  valor_frete: 1000,
  valor_piso_minimo_frete: 950,
  valor_vale_pedagio: 0,
  data_declaracao: "2026-09-01T10:00:00-03:00",
  data_inicio_viagem: "2026-09-02",
  data_fim_viagem: "2026-09-04",
  veiculos: [
    { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 },
    { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 3 },
  ],
  inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
};

test("declararCiotSchema: mdfe_id é opcional (parse ok sem ele)", () => {
  const ok = declararCiotSchema.parse(baseCiot);
  assert.equal(ok.mdfe_id ?? null, null);
});

test("declararCiotSchema: aceita mdfe_id e dados_carga.ncm", () => {
  const ok = declararCiotSchema.parse({
    ...baseCiot,
    mdfe_id: 77,
    dados_carga: {
      codigo_natureza_carga: "01",
      peso_carga: 15000,
      codigo_tipo_carga: 1,
      ncm: "12019000",
    },
  });
  assert.equal(ok.mdfe_id, 77);
  assert.equal(ok.dados_carga.ncm, "12019000");
});

test("verificarPisoMinimoFrete: frete >= piso > 0 passa", () => {
  assert.doesNotThrow(() =>
    verificarPisoMinimoFrete({ valor_frete: 1000, valor_piso_minimo_frete: 950 }),
  );
});

test("verificarPisoMinimoFrete: piso 0 bloqueia (sem consulta automática)", () => {
  assert.throws(
    () =>
      verificarPisoMinimoFrete({ valor_frete: 1000, valor_piso_minimo_frete: 0 }),
    /piso mínimo/i,
  );
});

test("verificarPisoMinimoFrete: frete abaixo do piso bloqueia", () => {
  assert.throws(
    () =>
      verificarPisoMinimoFrete({
        valor_frete: 800,
        valor_piso_minimo_frete: 950,
      }),
    /abaixo do piso/i,
  );
});
