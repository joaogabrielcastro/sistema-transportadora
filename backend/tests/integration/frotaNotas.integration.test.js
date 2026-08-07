import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  loginAsAdmin,
  createSecondaryTenantAdmin,
  loginWithCredentials,
  createCaminhaoViaApi,
  cleanupCaminhao,
  cleanupTenant,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

const uniq = (prefix) =>
  `${prefix}${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 90 + 10)}`.slice(
    0,
    7,
  ).toUpperCase();

test(
  "login abbroto expõe features com ordem_coleta e sem notas",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { user } = await loginAsAdmin(app);
    assert.ok(user.features);
    assert.equal(user.features.ordem_coleta, true);
    assert.equal(user.features.notas_estoque, false);
  },
);

test(
  "cria cavalo e carreta tipados e vincula composição",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const cavaloPlaca = uniq("CV");
    const carretaPlaca = uniq("CR");

    const cavalo = await createCaminhaoViaApi(app, authHeader, {
      placa: cavaloPlaca,
      tipo_veiculo: "cavalo",
      config_eixos: "6x2",
      qtd_pneus: 10,
      motorista: "Motorista Cavalo",
      marca: "Volvo",
      modelo: "FH 460 6x2T",
    });

    const carreta = await createCaminhaoViaApi(app, authHeader, {
      placa: carretaPlaca,
      tipo_veiculo: "carreta",
      qtd_pneus: 12,
      km_atual: 0,
      motorista: null,
      marca: "Randon",
      modelo: "SR CA",
    });

    try {
      assert.equal(cavalo.tipo_veiculo, "cavalo");
      assert.equal(carreta.tipo_veiculo, "carreta");

      const vinc = await request(app)
        .post(`/api/caminhoes/id/${cavalo.id}/vinculos`)
        .set(authHeader)
        .send({ carreta_id: carreta.id, ordem: 1 });

      assert.equal(vinc.status, 201, vinc.body?.error || "vincular falhou");
      assert.equal(vinc.body.data.carreta_id, carreta.id);

      const detail = await request(app)
        .get(`/api/caminhoes/${cavalo.placa}`)
        .set(authHeader);

      assert.equal(detail.status, 200);
      assert.ok(detail.body.data.composicao);
      assert.equal(detail.body.data.composicao.vinculos.length, 1);
      assert.equal(
        detail.body.data.composicao.vinculos[0].carreta.placa,
        carreta.placa,
      );

      const desv = await request(app)
        .delete(
          `/api/caminhoes/id/${cavalo.id}/vinculos/${vinc.body.data.id}`,
        )
        .set(authHeader);

      assert.equal(desv.status, 200, desv.body?.error || "desvincular falhou");

      const after = await request(app)
        .get(`/api/caminhoes/${cavalo.placa}`)
        .set(authHeader);
      assert.equal(after.body.data.composicao.vinculos.length, 0);
    } finally {
      await cleanupCaminhao(carreta.id);
      await cleanupCaminhao(cavalo.id);
    }
  },
);

test(
  "não permite vincular duas vezes a mesma carreta ativa",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const cavalo1 = await createCaminhaoViaApi(app, authHeader, {
      placa: uniq("C1"),
      tipo_veiculo: "cavalo",
      motorista: "A",
    });
    const cavalo2 = await createCaminhaoViaApi(app, authHeader, {
      placa: uniq("C2"),
      tipo_veiculo: "cavalo",
      motorista: "B",
    });
    const carreta = await createCaminhaoViaApi(app, authHeader, {
      placa: uniq("CX"),
      tipo_veiculo: "carreta",
      motorista: null,
    });

    try {
      const first = await request(app)
        .post(`/api/caminhoes/id/${cavalo1.id}/vinculos`)
        .set(authHeader)
        .send({ carreta_id: carreta.id });
      assert.equal(first.status, 201);

      const second = await request(app)
        .post(`/api/caminhoes/id/${cavalo2.id}/vinculos`)
        .set(authHeader)
        .send({ carreta_id: carreta.id });

      assert.equal(second.status, 409);
    } finally {
      await cleanupCaminhao(carreta.id);
      await cleanupCaminhao(cavalo1.id);
      await cleanupCaminhao(cavalo2.id);
    }
  },
);

test(
  "tenant Motin acessa notas; Abbroto recebe 403 em notas e Motin 403 em OC",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const abbroto = await loginAsAdmin(app);

    const blockedAbb = await request(app)
      .get("/api/notas-fiscais")
      .set(abbroto.authHeader);
    assert.equal(blockedAbb.status, 403);

    const slug = `motin-t-${Date.now().toString(36)}`.slice(0, 30);
    const secondary = await createSecondaryTenantAdmin({
      slug,
      email: `motin-${Date.now().toString(36)}@test.local`,
      nome: "Trans Motin Test",
      features: { ordem_coleta: false, notas_estoque: true },
    });

    const motin = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );

    try {
      assert.equal(motin.user.features.notas_estoque, true);
      assert.equal(motin.user.features.ordem_coleta, false);

      const notas = await request(app)
        .get("/api/notas-fiscais")
        .set(motin.authHeader);
      assert.equal(notas.status, 200, notas.body?.error);

      const oc = await request(app)
        .get("/api/ordem-coleta/historico")
        .set(motin.authHeader);
      assert.equal(oc.status, 403);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "importa NF-e XML → estoque → baixa (tenant com notas_estoque)",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const slug = `nfe-${Date.now().toString(36)}`.slice(0, 30);
    const secondary = await createSecondaryTenantAdmin({
      slug,
      email: `nfe-${Date.now().toString(36)}@test.local`,
      features: { ordem_coleta: false, notas_estoque: true },
    });
    const session = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );

    const chave = `4126${String(Date.now()).padStart(40, "0")}`.slice(0, 44);
    const xml = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe${chave}">
  <ide><nNF>99001</nNF><serie>1</serie><dhEmi>2026-08-05T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>12345678000199</CNPJ><xNome>FORNECEDOR TESTE</xNome></emit>
  <det nItem="1"><prod>
    <cProd>FILTRO01</cProd><xProd>FILTRO ARLA TESTE</xProd>
    <NCM>84212990</NCM><uCom>UN</uCom><qCom>3.0000</qCom>
    <vUnCom>10.00</vUnCom><vProd>30.00</vProd>
  </prod></det>
  <det nItem="2"><prod>
    <cProd>PARAF01</cProd><xProd>PARAFUSO TESTE</xProd>
    <uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>1.00</vUnCom><vProd>10.00</vProd>
  </prod></det>
  <total><ICMSTot><vNF>40.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

    try {
      const preview = await request(app)
        .post("/api/notas-fiscais/preview")
        .set(session.authHeader)
        .attach("xml", Buffer.from(xml, "utf8"), "nfe.xml");

      assert.equal(preview.status, 200, preview.body?.error);
      assert.equal(preview.body.data.itens.length, 2);
      assert.equal(preview.body.data.numero, "99001");

      const importar = await request(app)
        .post("/api/notas-fiscais/importar")
        .set(session.authHeader)
        .field("payload", JSON.stringify(preview.body.data))
        .attach("xml", Buffer.from(xml, "utf8"), "nfe.xml");

      assert.equal(importar.status, 201, importar.body?.error);
      assert.equal(importar.body.data.itens.length, 2);

      const produtos = await request(app)
        .get("/api/notas-fiscais/produtos")
        .set(session.authHeader);
      assert.equal(produtos.status, 200);
      assert.ok(produtos.body.data.length >= 2);

      const filtro = produtos.body.data.find((p) => p.codigo === "FILTRO01");
      assert.ok(filtro);
      assert.equal(Number(filtro.saldo), 3);

      const baixa = await request(app)
        .post("/api/notas-fiscais/estoque/baixa")
        .set(session.authHeader)
        .send({
          produto_id: filtro.id,
          quantidade: 1,
          motivo: "Uso em teste",
        });
      assert.equal(baixa.status, 201, baixa.body?.error);

      const after = await request(app)
        .get("/api/notas-fiscais/produtos")
        .set(session.authHeader);
      const filtroAfter = after.body.data.find((p) => p.id === filtro.id);
      assert.equal(Number(filtroAfter.saldo), 2);

      const movs = await request(app)
        .get("/api/notas-fiscais/movimentos")
        .query({ produto_id: filtro.id })
        .set(session.authHeader);
      assert.equal(movs.status, 200);
      assert.ok(movs.body.data.some((m) => m.tipo === "entrada"));
      assert.ok(movs.body.data.some((m) => m.tipo === "baixa"));
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "GET /auth/me retorna features do tenant",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const me = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(me.status, 200);
    assert.ok(me.body.data.features);
    assert.equal(typeof me.body.data.features.ordem_coleta, "boolean");
    assert.equal(typeof me.body.data.features.notas_estoque, "boolean");
  },
);

test(
  "seed de posições de carreta existe após migration",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    await loginAsAdmin(app);
    const count = await prisma.posicoes_pneus.count({
      where: { nome_posicao: { startsWith: "Carreta -" } },
    });
    assert.ok(count >= 12, `esperava posições Carreta, got ${count}`);
  },
);
