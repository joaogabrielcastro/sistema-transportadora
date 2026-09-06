import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

process.env.FISCAL_SECRETS_KEY =
  process.env.FISCAL_SECRETS_KEY || "unit-test-fiscal-secrets-key";

const { AverbacaoService } = await import(
  "../../src/services/averbacao/AverbacaoService.js"
);
const { encryptSecret } = await import("../../src/utils/fiscalCrypto.js");

describe("AverbacaoService serialização", () => {
  it("config pública nunca devolve senha/token/usuario em texto", () => {
    const pub = AverbacaoService.publicConfig({
      id: 1,
      tenant_id: 44,
      provider: "atm",
      ambiente: "homologacao",
      automatico: true,
      ativo: true,
      codigo_atm: "11000000",
      usuario_encrypted: encryptSecret("usuario-real"),
      senha_encrypted: encryptSecret("senha-super-secreta"),
      status_integracao: "ok",
    });
    const json = JSON.stringify(pub);
    assert.equal(pub.usuario_set, true);
    assert.equal(pub.senha_set, true);
    assert.equal(pub.usuario_encrypted, undefined);
    assert.equal(pub.senha_encrypted, undefined);
    assert.equal(json.includes("senha-super-secreta"), false);
    assert.equal(json.includes("usuario-real"), false);
    assert.equal(pub.codigo_atm, "11000000");
    assert.equal(pub.ambiente, "homologacao");
  });

  it("config ausente devolve defaults de homologação desligada", () => {
    const pub = AverbacaoService.publicConfig(null);
    assert.equal(pub.automatico, false);
    assert.equal(pub.ativo, false);
    assert.equal(pub.ambiente, "homologacao");
    assert.equal(pub.usuario_set, false);
  });

  it("averbação pública não mistura tenant nem vaza XML/response", () => {
    const pub = AverbacaoService.publicAverbacao({
      id: 8,
      tenant_id: 1,
      cte_id: 99,
      status: "averbed",
      protocolo: "P",
      request_meta: { xml_sha256: "abc" },
      response_data: { Bearer: "nao" },
    });
    assert.equal(pub.tenant_id, 1);
    assert.equal(pub.cte_id, 99);
    assert.equal(pub.request_meta, undefined);
    assert.equal(pub.response_data, undefined);
  });
});

describe("isolamento entre tenants", () => {
  it("consultas em fiscal_averbacoes e fiscal_seguro_config filtram tenant_id", async () => {
    const src = await fs.readFile(
      new URL("../../src/services/averbacao/AverbacaoService.js", import.meta.url),
      "utf8",
    );
    const chunks = src.split(/prisma\.fiscal_(averbacoes|seguro_config)/).slice(1);
    assert.ok(chunks.length > 2);
    for (let i = 0; i < chunks.length; i += 2) {
      const snippet = String(chunks[i + 1] || "").slice(0, 500);
      if (snippet.includes("create(")) continue;
      assert.match(
        snippet,
        /tenant_id/,
        `chamada Prisma sem tenant_id: ${snippet.slice(0, 160)}`,
      );
    }
  });
});
