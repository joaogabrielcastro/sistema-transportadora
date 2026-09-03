import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chave44Valida,
  regimeSimplesNacional,
  exigeGrupoIbsCbs,
  empresaFiscalSemCrt,
  resolverEmpresaFiscalAtiva,
  tiposDocumentoConflitantes,
  documentoInfDocValido,
  mdfeExigeGruposAntt,
  mostrarDifalCte,
} from "./fiscalForms.js";

// Corpo de 43 dígitos "3" -> DV módulo 11 = 6 (mesma conta do backend).
const CHAVE_VALIDA = "3".repeat(43) + "6";

describe("chave44Valida", () => {
  it("aceita chave de 44 dígitos com DV correto", () => {
    assert.equal(chave44Valida(CHAVE_VALIDA), true);
  });

  it("ignora máscara (pontos/espaços) antes de validar", () => {
    const mascarada = CHAVE_VALIDA.replace(/(.{4})/g, "$1 ").trim();
    assert.equal(chave44Valida(mascarada), true);
  });

  it("rejeita DV incorreto", () => {
    assert.equal(chave44Valida("3".repeat(43) + "5"), false);
  });

  it("rejeita comprimento diferente de 44", () => {
    assert.equal(chave44Valida("3".repeat(43)), false);
    assert.equal(chave44Valida("3".repeat(45)), false);
  });

  it("rejeita vazio / nulo", () => {
    assert.equal(chave44Valida(""), false);
    assert.equal(chave44Valida(null), false);
    assert.equal(chave44Valida(undefined), false);
  });
});

describe("regimeSimplesNacional / exigeGrupoIbsCbs", () => {
  it("CRT 1, 2 e 4 são Simples Nacional (dispensados do IBS/CBS)", () => {
    for (const crt of [1, 2, 4, "1", "2", "4"]) {
      assert.equal(regimeSimplesNacional(crt), true, `crt ${crt}`);
      assert.equal(exigeGrupoIbsCbs(crt), false, `crt ${crt}`);
    }
  });

  it("CRT 3 (Regime Normal) exige o grupo IBS/CBS", () => {
    assert.equal(regimeSimplesNacional(3), false);
    assert.equal(exigeGrupoIbsCbs(3), true);
    assert.equal(exigeGrupoIbsCbs("3"), true);
  });

  it("CRT ausente não exibe o grupo (bloqueio é tratado à parte)", () => {
    assert.equal(exigeGrupoIbsCbs(null), false);
    assert.equal(exigeGrupoIbsCbs(""), false);
    assert.equal(exigeGrupoIbsCbs(undefined), false);
  });
});

describe("empresaFiscalSemCrt", () => {
  it("true quando não há empresa ou o CRT está vazio", () => {
    assert.equal(empresaFiscalSemCrt(null), true);
    assert.equal(empresaFiscalSemCrt({}), true);
    assert.equal(empresaFiscalSemCrt({ crt: null }), true);
    assert.equal(empresaFiscalSemCrt({ crt: "" }), true);
  });

  it("false quando o CRT está preenchido (inclusive 0-like não se aplica)", () => {
    assert.equal(empresaFiscalSemCrt({ crt: 1 }), false);
    assert.equal(empresaFiscalSemCrt({ crt: 3 }), false);
  });
});

describe("resolverEmpresaFiscalAtiva", () => {
  it("retorna a primeira empresa ativa", () => {
    const lista = [
      { id: 1, ativo: false },
      { id: 2, ativo: true },
      { id: 3, ativo: true },
    ];
    assert.equal(resolverEmpresaFiscalAtiva(lista).id, 2);
  });

  it("cai para a primeira da lista quando nenhuma está marcada ativa", () => {
    const lista = [{ id: 7, ativo: false }];
    assert.equal(resolverEmpresaFiscalAtiva(lista).id, 7);
  });

  it("null para lista vazia / inválida", () => {
    assert.equal(resolverEmpresaFiscalAtiva([]), null);
    assert.equal(resolverEmpresaFiscalAtiva(null), null);
  });
});

describe("tiposDocumentoConflitantes", () => {
  it("true quando há 'nfe' e 'nf' juntos", () => {
    assert.equal(tiposDocumentoConflitantes(["nfe", "nf"]), true);
    assert.equal(tiposDocumentoConflitantes(["nf", "nfe", "nf"]), true);
  });

  it("false quando só há um tipo (ou 'outros' no meio)", () => {
    assert.equal(tiposDocumentoConflitantes(["nfe", "nfe"]), false);
    assert.equal(tiposDocumentoConflitantes(["nf", "outros"]), false);
    assert.equal(tiposDocumentoConflitantes([]), false);
  });
});

describe("documentoInfDocValido", () => {
  it("'nfe' exige chave de 44 dígitos válida", () => {
    assert.equal(documentoInfDocValido({ tipo: "nfe", chave: CHAVE_VALIDA }), true);
    assert.equal(documentoInfDocValido({ tipo: "nfe", chave: "123" }), false);
    assert.equal(documentoInfDocValido({ tipo: "nfe" }), false);
  });

  it("'nf' e 'outros' exigem número", () => {
    assert.equal(documentoInfDocValido({ tipo: "nf", numero: "123" }), true);
    assert.equal(documentoInfDocValido({ tipo: "nf", numero: "  " }), false);
    assert.equal(documentoInfDocValido({ tipo: "outros", numero: "9" }), true);
  });

  it("false para documento nulo / tipo desconhecido", () => {
    assert.equal(documentoInfDocValido(null), false);
    assert.equal(documentoInfDocValido({ tipo: "xpto", numero: "1" }), false);
  });
});

describe("mostrarDifalCte", () => {
  const base = {
    ufIni: "SP",
    ufFim: "MG",
    tomadorIndIe: 9,
    tomadorDoc: "12345678000199",
    remetenteDoc: "99999999000191",
  };

  it("true com as três condições (interestadual + não contribuinte + tomador != remetente)", () => {
    assert.equal(mostrarDifalCte(base), true);
  });

  it("false quando a operação não é interestadual", () => {
    assert.equal(mostrarDifalCte({ ...base, ufFim: "SP" }), false);
    assert.equal(mostrarDifalCte({ ...base, ufFim: "" }), false);
  });

  it("false quando o tomador é contribuinte / isento (ind_ie != 9)", () => {
    assert.equal(mostrarDifalCte({ ...base, tomadorIndIe: 1 }), false);
    assert.equal(mostrarDifalCte({ ...base, tomadorIndIe: "" }), false);
  });

  it("false quando tomador e remetente têm o mesmo documento (ignora máscara)", () => {
    assert.equal(
      mostrarDifalCte({ ...base, remetenteDoc: "12.345.678/0001-99" }),
      false,
    );
  });

  it("true quando o remetente não foi informado (não dá para provar que é igual)", () => {
    assert.equal(mostrarDifalCte({ ...base, remetenteDoc: "" }), true);
  });

  it("false / seguro para argumento vazio", () => {
    assert.equal(mostrarDifalCte(), false);
    assert.equal(mostrarDifalCte({}), false);
  });
});

describe("mdfeExigeGruposAntt", () => {
  it("exige para tipo_emitente 1 e 3 (prestador)", () => {
    assert.equal(mdfeExigeGruposAntt(1), true);
    assert.equal(mdfeExigeGruposAntt("1"), true);
    assert.equal(mdfeExigeGruposAntt(3), true);
    assert.equal(mdfeExigeGruposAntt("3"), true);
  });

  it("não exige para 2 (carga própria), ausente ou vazio", () => {
    assert.equal(mdfeExigeGruposAntt(2), false);
    assert.equal(mdfeExigeGruposAntt(""), false);
    assert.equal(mdfeExigeGruposAntt(null), false);
    assert.equal(mdfeExigeGruposAntt(undefined), false);
  });
});
