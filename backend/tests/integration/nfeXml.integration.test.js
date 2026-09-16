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
  ensureRegistroLookups,
} from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

function chave44(prefix = "4126") {
  return `${prefix}${String(Date.now())}${Math.floor(Math.random() * 1e12)}`.replace(
    /\D/g,
    "",
  ).slice(0, 44).padEnd(44, "0");
}

function xmlCarga({ chave, destCnpj = "11222333000181" }) {
  return `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe${chave}">
  <ide><nNF>598</nNF><serie>1</serie><dhEmi>2026-08-05T15:39:29-03:00</dhEmi></ide>
  <emit>
    <CNPJ>15025390000121</CNPJ><xNome>REMETENTE LTDA</xNome>
    <enderEmit><UF>PR</UF></enderEmit>
  </emit>
  <dest>
    <CNPJ>${destCnpj}</CNPJ><xNome>DESTINATARIO SA</xNome>
    <enderDest><UF>SP</UF></enderDest>
  </dest>
  <det nItem="1"><prod>
    <cProd>SOJA</cProd><xProd>SOJA EM GRAOS</xProd>
    <NCM>12019000</NCM><CFOP>5102</CFOP>
    <uCom>KG</uCom><qCom>12500</qCom>
    <vUnCom>1.20</vUnCom><vProd>15000.00</vProd>
  </prod></det>
  <total><ICMSTot><vNF>15000.00</vNF></ICMSTot></total>
  <transp><vol><pesoB>12.500</pesoB></vol></transp>
</infNFe></NFe></nfeProc>`;
}

function xmlFuel({ chave, placa }) {
  return `<?xml version="1.0"?>
<nfeProc><NFe><infNFe Id="NFe${chave}">
  <ide><nNF>606</nNF><serie>1</serie><dhEmi>2026-08-06T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>00394494000103</CNPJ><xNome>POSTO TESTE</xNome></emit>
  <det nItem="1"><prod>
    <cProd>S10</cProd><xProd>OLEO DIESEL S10</xProd>
    <NCM>27101921</NCM><uCom>L</uCom>
    <qCom>150.0000</qCom><vUnCom>6.1990</vUnCom><vProd>929.85</vProd>
    <comb><cANP>210203001</cANP></comb>
  </prod></det>
  <total><ICMSTot><vNF>929.85</vNF></ICMSTot></total>
  ${placa ? `<infAdic><infCpl>PLACA ${placa}</infCpl></infAdic>` : ""}
</infNFe></NFe></nfeProc>`;
}

test(
  "POST /api/fiscal/cte/ler-xml lê NF-e de carga e recusa combustível sozinho",
  { skip },
  async () => {
    const secondary = await createSecondaryTenantAdmin({
      slug: `nfe-cte-${Date.now().toString(36)}`,
      email: `nfe-cte-${Date.now().toString(36)}@tenant.local`,
      features: {
        ordem_coleta: false,
        notas_estoque: false,
        transporte_fiscal: true,
      },
    });
    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );
      const carga = await request(app)
        .post("/api/fiscal/cte/ler-xml")
        .set(authHeader)
        .attach("xml", Buffer.from(xmlCarga({ chave: chave44() }), "utf8"), "carga.xml");
      assert.equal(carga.status, 200, carga.body?.error);
      assert.equal(carga.body.data.notas.length, 1);
      assert.equal(carga.body.data.notas[0].destinatario.uf, "SP");
      assert.equal(carga.body.data.notas[0].peso_bruto, 12.5);
      assert.equal(carga.body.data.notas[0].itens[0].cfop, "5102");

      const fuel = await request(app)
        .post("/api/fiscal/cte/ler-xml")
        .set(authHeader)
        .attach(
          "xml",
          Buffer.from(xmlFuel({ chave: chave44() }), "utf8"),
          "posto.xml",
        );
      assert.equal(fuel.status, 400);
      assert.match(String(fuel.body?.error || ""), /combustível/i);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "XML de combustível lança gasto no caminhão e bloqueia duplicata da chave",
  { skip },
  async () => {
    const { authHeader, tenantId } = await loginAsAdmin(app);
    await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);
    const chave = chave44();
    const xml = xmlFuel({ chave, placa: caminhao.placa });

    try {
      const cargaNoPosto = await request(app)
        .post("/api/gastos/preview-xml-combustivel")
        .set(authHeader)
        .attach(
          "xml",
          Buffer.from(xmlCarga({ chave: chave44() }), "utf8"),
          "carga.xml",
        );
      assert.equal(cargaNoPosto.status, 400);

      const preview = await request(app)
        .post("/api/gastos/preview-xml-combustivel")
        .set(authHeader)
        .attach("xml", Buffer.from(xml, "utf8"), "posto.xml");
      assert.equal(preview.status, 200, preview.body?.error);
      assert.equal(preview.body.data.quantidade_litros, 150);
      assert.equal(preview.body.data.uso, "combustivel");

      const imported = await request(app)
        .post("/api/gastos/importar-xml-combustivel")
        .set(authHeader)
        .attach("xml", Buffer.from(xml, "utf8"), "posto.xml");
      assert.equal(imported.status, 201, imported.body?.error);
      assert.equal(Number(imported.body.data.caminhao_id), caminhao.id);
      assert.equal(Number(imported.body.data.quantidade_combustivel), 150);
      assert.equal(imported.body.data.status_pagamento, "pago");
      assert.equal(imported.body.data.detalhes?.chave_nfe, chave);

      const dup = await request(app)
        .post("/api/gastos/importar-xml-combustivel")
        .set(authHeader)
        .attach("xml", Buffer.from(xml, "utf8"), "posto.xml");
      assert.equal(dup.status, 409);

      const gasto = await prisma.gastos.findFirst({
        where: { id: imported.body.data.id, tenant_id: tenantId },
      });
      assert.ok(gasto);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);
