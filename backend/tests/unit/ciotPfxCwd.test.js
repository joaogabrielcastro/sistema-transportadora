import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.FISCAL_SECRETS_KEY =
  process.env.FISCAL_SECRETS_KEY || "unit-test-fiscal-secrets-key";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ciot-pfx-"));
process.env.UPLOADS_DIR = TMP;

const prisma = (await import("../../src/lib/prisma.js")).default;
const { encryptSecret } = await import("../../src/utils/fiscalCrypto.js");
const { resolveEmpresaCertificado } = await import(
  "../../src/services/fiscal/fiscalShared.js"
);

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("CIOT PFX absoluto (independente do cwd)", () => {
  it("resolve o certificado mesmo com cwd diferente da aplicação", async () => {
    const rel = path.join("fiscal", "certificados", "1", "9.pfx");
    const abs = path.join(TMP, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "fake-pfx");

    const origFind = prisma.fiscal_empresas.findFirst;
    prisma.fiscal_empresas.findFirst = async () => ({
      id: 9,
      tenant_id: 1,
      cnpj: "11222333000181",
      certificado_pfx_path: rel.replace(/\\/g, "/"),
      certificado_senha: encryptSecret("senha-pfx"),
    });

    const cwdAntes = process.cwd();
    const outro = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-"));
    try {
      process.chdir(outro);
      const { certificado } = await resolveEmpresaCertificado(1, 9);
      assert.equal(path.isAbsolute(certificado.pfxPath), true);
      assert.equal(fs.existsSync(certificado.pfxPath), true);
      assert.equal(certificado.pfxPath, path.resolve(abs));
      assert.equal(certificado.senha, "senha-pfx");
    } finally {
      process.chdir(cwdAntes);
      fs.rmSync(outro, { recursive: true, force: true });
      prisma.fiscal_empresas.findFirst = origFind;
    }
  });
});
