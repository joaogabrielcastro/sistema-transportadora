import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposFormularioPorTipo,
  buildEmptyDadosVariaveis,
  ORDEM_COLETA_CAMPOS_PADRAO,
  ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
} from "./ordemColetaFields.js";

test("camposFormularioPorTipo escolhe CANOINHAS vs padrão", () => {
  assert.equal(
    camposFormularioPorTipo("CANOINHAS"),
    ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
  );
  assert.equal(camposFormularioPorTipo("PADRAO"), ORDEM_COLETA_CAMPOS_PADRAO);
});

test("buildEmptyDadosVariaveis preenche chaves vazias", () => {
  const empty = buildEmptyDadosVariaveis();
  assert.equal(empty.mercadoria, "");
  assert.equal(empty.razao_social, "");
  assert.ok(Object.keys(empty).length >= ORDEM_COLETA_CAMPOS_PADRAO.length);
});
