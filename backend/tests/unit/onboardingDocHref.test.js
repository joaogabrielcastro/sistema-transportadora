import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a regra de destino do passo "documento" do OnboardingService
 * (sem banco): com frota → /documentos; sem frota → cadastro.
 */
function docStepHref(caminhoesCount) {
  return caminhoesCount > 0 ? "/documentos" : "/cadastro-caminhao";
}

test("passo documento aponta para /documentos quando já há veículo", () => {
  assert.equal(docStepHref(1), "/documentos");
  assert.equal(docStepHref(3), "/documentos");
});

test("passo documento aponta para cadastro quando ainda não há veículo", () => {
  assert.equal(docStepHref(0), "/cadastro-caminhao");
});
