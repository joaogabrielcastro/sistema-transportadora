import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPositionDiagram } from "./pneuPosicaoMap.js";

const posicoes = [
  { id: 1, nome_posicao: "Dianteiro Esquerdo" },
  { id: 2, nome_posicao: "Dianteiro Direito" },
  { id: 3, nome_posicao: "Eixo 2 - Externo Esquerdo" },
  { id: 4, nome_posicao: "Eixo 2 - Interno Esquerdo" },
  { id: 5, nome_posicao: "Eixo 2 - Externo Direito" },
  { id: 6, nome_posicao: "Eixo 2 - Interno Direito" },
  { id: 7, nome_posicao: "Eixo 3 - Externo Esquerdo" },
  { id: 8, nome_posicao: "Eixo 3 - Interno Esquerdo" },
  { id: 9, nome_posicao: "Eixo 3 - Externo Direito" },
  { id: 10, nome_posicao: "Eixo 3 - Interno Direito" },
  { id: 11, nome_posicao: "Eixo 4 - Externo Esquerdo" },
  { id: 12, nome_posicao: "Eixo 4 - Interno Esquerdo" },
  { id: 15, nome_posicao: "Eixo 4 - Externo Direito" },
  { id: 16, nome_posicao: "Eixo 4 - Interno Direito" },
  { id: 13, nome_posicao: "Estepe 1" },
  { id: 14, nome_posicao: "Estepe 2" },
];

test("caminhão com 6 pneus mostra dianteiro + 1 eixo traseiro", () => {
  const diagram = buildPositionDiagram(posicoes, { qtd_pneus: 6, placa: "ABC1D23" });

  assert.equal(diagram.axles.length, 1);
  assert.equal(diagram.axles[0].number, 2);
  assert.equal(diagram.spares.length, 0);
  assert.equal(diagram.allowedIds.size, 6);
});

test("caminhão com 10 pneus mostra dianteiro + 2 eixos traseiros", () => {
  const diagram = buildPositionDiagram(posicoes, { qtd_pneus: 10 });

  assert.equal(diagram.axles.length, 2);
  assert.equal(diagram.axles[0].number, 2);
  assert.equal(diagram.axles[1].number, 3);
  assert.equal(diagram.spares.length, 0);
});

test("caminhão com 14 pneus mostra 3 eixos traseiros (sem estepes)", () => {
  const diagram = buildPositionDiagram(posicoes, {
    qtd_pneus: 14,
    placa_carreta_1: "XYZ9K88",
  });

  assert.equal(diagram.axles.length, 3);
  assert.equal(diagram.spares.length, 0);
  assert.equal(diagram.allowedIds.size, 14);
});

test("caminhão com 16 pneus inclui estepes após os eixos", () => {
  const diagram = buildPositionDiagram(posicoes, { qtd_pneus: 16 });

  assert.equal(diagram.axles.length, 3);
  assert.equal(diagram.spares.length, 2);
  assert.equal(diagram.allowedIds.size, 16);
});
