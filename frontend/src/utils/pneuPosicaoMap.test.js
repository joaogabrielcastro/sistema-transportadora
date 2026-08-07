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

test("carreta usa posições Carreta - e não mostra dianteiro", () => {
  const comCarreta = [
    ...posicoes,
    { id: 101, nome_posicao: "Carreta - Eixo 1 - Externo Esquerdo" },
    { id: 102, nome_posicao: "Carreta - Eixo 1 - Interno Esquerdo" },
    { id: 103, nome_posicao: "Carreta - Eixo 1 - Interno Direito" },
    { id: 104, nome_posicao: "Carreta - Eixo 1 - Externo Direito" },
    { id: 105, nome_posicao: "Carreta - Eixo 2 - Externo Esquerdo" },
    { id: 106, nome_posicao: "Carreta - Eixo 2 - Interno Esquerdo" },
    { id: 107, nome_posicao: "Carreta - Eixo 2 - Interno Direito" },
    { id: 108, nome_posicao: "Carreta - Eixo 2 - Externo Direito" },
    { id: 109, nome_posicao: "Carreta - Eixo 3 - Externo Esquerdo" },
    { id: 110, nome_posicao: "Carreta - Eixo 3 - Interno Esquerdo" },
    { id: 111, nome_posicao: "Carreta - Eixo 3 - Interno Direito" },
    { id: 112, nome_posicao: "Carreta - Eixo 3 - Externo Direito" },
  ];

  const diagram = buildPositionDiagram(comCarreta, {
    tipo_veiculo: "carreta",
    qtd_pneus: 12,
    placa: "AIE4604",
  });

  assert.equal(diagram.tipo, "carreta");
  assert.equal(diagram.front.left, null);
  assert.equal(diagram.front.right, null);
  assert.equal(diagram.axles.length, 3);
  assert.equal(diagram.allowedIds.size, 12);
  assert.match(diagram.title, /Carreta/i);
});

test("cavalo ignora posições prefixadas Carreta", () => {
  const mixed = [
    ...posicoes,
    { id: 201, nome_posicao: "Carreta - Eixo 1 - Externo Esquerdo" },
  ];
  const diagram = buildPositionDiagram(mixed, {
    tipo_veiculo: "cavalo",
    qtd_pneus: 6,
  });
  assert.equal(diagram.tipo, "cavalo");
  assert.equal(diagram.allowedIds.has(201), false);
  assert.equal(diagram.allowedIds.size, 6);
});

test("buildCompositionDiagrams monta seções cavalo + carreta", async () => {
  const { buildCompositionDiagrams } = await import("./pneuPosicaoMap.js");
  const comCarreta = [
    ...posicoes,
    { id: 101, nome_posicao: "Carreta - Eixo 1 - Externo Esquerdo" },
    { id: 102, nome_posicao: "Carreta - Eixo 1 - Interno Esquerdo" },
    { id: 103, nome_posicao: "Carreta - Eixo 1 - Interno Direito" },
    { id: 104, nome_posicao: "Carreta - Eixo 1 - Externo Direito" },
  ];
  const sections = buildCompositionDiagrams(
    comCarreta,
    { id: 1, placa: "EOE1909", tipo_veiculo: "cavalo", qtd_pneus: 6 },
    [{ id: 2, placa: "AWT3125", tipo_veiculo: "carreta", qtd_pneus: 4 }],
  );
  assert.equal(sections.length, 2);
  assert.equal(sections[0].diagram.tipo, "cavalo");
  assert.equal(sections[1].diagram.tipo, "carreta");
});

test("filterPosicoesForCaminhao e isPosicaoAllowedForCaminhao", async () => {
  const { filterPosicoesForCaminhao, isPosicaoAllowedForCaminhao, mapPosicoesToSlots } =
    await import("./pneuPosicaoMap.js");

  const filtered = filterPosicoesForCaminhao(posicoes, { qtd_pneus: 6 });
  assert.equal(filtered.length, 6);
  assert.equal(isPosicaoAllowedForCaminhao(1, posicoes, { qtd_pneus: 6 }), true);
  assert.equal(isPosicaoAllowedForCaminhao(13, posicoes, { qtd_pneus: 6 }), false);
  assert.equal(isPosicaoAllowedForCaminhao(null, posicoes, { qtd_pneus: 6 }), true);

  const mapped = mapPosicoesToSlots(posicoes);
  assert.ok(mapped.bySlot["front-left"]);
});
