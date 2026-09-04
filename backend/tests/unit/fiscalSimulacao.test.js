import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  empresaTemCertificadoA1,
  montarEtapasSimulacao,
  resultadoSimulacaoDocumento,
} from "../../src/services/fiscal/fiscalSimulacao.js";

describe("simulação fiscal (sem SEFAZ)", () => {
  it("marca Assinar e Autorização SEFAZ como pendentes sem certificado A1", () => {
    const etapas = montarEtapasSimulacao({ tipo: "cte", temCertificado: false });
    const ids = etapas.map((e) => e.id);
    assert.deepEqual(ids, [
      "preencher",
      "validar",
      "xml",
      "assinar",
      "enviar",
      "retorno",
      "dacte",
    ]);
    assert.equal(etapas.find((e) => e.id === "assinar").status, "pendente");
    assert.equal(etapas.find((e) => e.id === "retorno").status, "pendente");
    assert.equal(etapas.find((e) => e.id === "enviar").status, "simulado");
    assert.equal(etapas.find((e) => e.id === "validar").status, "ok");
  });

  it("não inventa chave nem diz que transmitiu", () => {
    const r = resultadoSimulacaoDocumento({
      tipo: "cte",
      documento: { id: 9, ambiente: 2, status: "rascunho" },
      payload: { ModeloDocumento: 57, TipoAmbiente: 2 },
      empresa: { certificado_senha: null, certificado_pfx_path: null },
    });
    assert.equal(r.simulacao, true);
    assert.equal(r.transmitido, false);
    assert.equal(r.pendencias.certificado_a1, true);
    assert.equal(r.pendencias.autorizacao_sefaz, true);
    assert.equal(r.payload_brasil_nfe.ModeloDocumento, 57);
    assert.equal(empresaTemCertificadoA1({ certificado_senha: null }), false);
    assert.equal(
      empresaTemCertificadoA1({
        certificado_senha: "fsc1:x",
        certificado_pfx_path: "a.pfx",
      }),
      true,
    );
  });

  it("MDF-e usa DAMDFE no pipeline", () => {
    const etapas = montarEtapasSimulacao({ tipo: "mdfe", temCertificado: true });
    assert.equal(etapas.at(-1).label, "DAMDFE");
    assert.equal(etapas.find((e) => e.id === "assinar").status, "pronto");
  });

  it("CIOT não fala em SEFAZ e não inventa número", () => {
    const etapas = montarEtapasSimulacao({ tipo: "ciot", temCertificado: false });
    assert.equal(etapas.find((e) => e.id === "retorno").label, "Número CIOT");
    assert.equal(etapas.find((e) => e.id === "enviar").status, "simulado");
    const r = resultadoSimulacaoDocumento({
      tipo: "ciot",
      documento: { status: "simulacao", valor_frete: 1500 },
      payload: { TipoOperacao: 1, ValorFrete: 1500 },
      empresa: { certificado_senha: null, certificado_pfx_path: null },
    });
    assert.equal(r.simulacao, true);
    assert.equal(r.transmitido, false);
    assert.equal(r.payload_ciot.TipoOperacao, 1);
    assert.equal(r.pendencias.numero_ciot, true);
    assert.match(r.aviso, /ANTT/);
  });
});
