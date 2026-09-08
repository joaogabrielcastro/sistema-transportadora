import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CIOT_STATUS } from "../../src/services/fiscal/ciotOperacao.js";

process.env.FISCAL_SECRETS_KEY =
  process.env.FISCAL_SECRETS_KEY || "unit-test-fiscal-secrets-key";

const prisma = (await import("../../src/lib/prisma.js")).default;
const { CiotService } = await import("../../src/services/fiscal/CiotService.js");
const { CiotProviderClient } = await import(
  "../../src/services/fiscal/CiotProviderClient.js"
);
const { encryptSecret } = await import("../../src/utils/fiscalCrypto.js");
const { UPLOADS_ROOT } = await import("../../src/utils/uploadPaths.js");

describe("CIOT concorrência no registrar", () => {
  it("segunda requisição simultânea recebe 409 e não dispara segundo POST", async () => {
    const contrato = {
      id: 4,
      tenant_id: 1,
      status: "aberto",
      fiscal_empresa_id: 9,
      tipo_operacao: 3,
      cpf_cnpj_contratado: "11222333000181",
      cpf_cnpj_contratante: "12345678000195",
      rntrc_contratado: "123456789",
      valor_frete: 1000,
      valor_piso_minimo_frete: 800,
      valor_vale_pedagio: 0,
      data_inicio_viagem: new Date().toISOString(),
      data_fim_viagem: new Date().toISOString(),
      data_declaracao: new Date().toISOString(),
      veiculos: [
        { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 3 },
        { placa: "XYZ2E34", rntrc_veiculo: "123456789", numero_eixos: 2 },
      ],
      inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
    };
    const ciot = {
      id: 1,
      contrato_frete_id: 4,
      tenant_id: 1,
      status: CIOT_STATUS.REGISTRANDO,
      id_operacao_transporte: "ABCDEF123456",
    };

    const rel = path.join("fiscal", "certificados", "1", "9.pfx");
    const abs = path.join(UPLOADS_ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "fake-pfx");
    const origTx = prisma.$transaction;
    const origFindContrato = prisma.fiscal_contratos_frete.findFirst;
    const origFindEmpresa = prisma.fiscal_empresas.findFirst;
    const origUpdate = prisma.fiscal_ciots.update;
    const origDeclarar = CiotProviderClient.declararOperacaoTransporte;

    prisma.fiscal_contratos_frete.findFirst = async () => contrato;
    prisma.fiscal_empresas.findFirst = async () => ({
      id: 9,
      tenant_id: 1,
      cnpj: "11222333000181",
      certificado_pfx_path: "fiscal/certificados/1/9.pfx",
      certificado_senha: encryptSecret("x"),
    });
    prisma.$transaction = async (fn) =>
      fn({
        $queryRaw: async () => [{ id: 4, status: "aberto" }],
        fiscal_ciots: {
          findFirst: async () => ciot,
          findUnique: async () => null,
          update: async () => ciot,
          create: async () => ciot,
        },
      });
    let posts = 0;
    CiotProviderClient.declararOperacaoTransporte = async () => {
      posts += 1;
      return { Codigo: 1 };
    };

    try {
      await assert.rejects(() => CiotService.registrar(1, 4, {}), (e) => e.statusCode === 409);
      assert.equal(posts, 0);
    } finally {
      prisma.$transaction = origTx;
      prisma.fiscal_contratos_frete.findFirst = origFindContrato;
      prisma.fiscal_empresas.findFirst = origFindEmpresa;
      prisma.fiscal_ciots.update = origUpdate;
      CiotProviderClient.declararOperacaoTransporte = origDeclarar;
    }
  });
});
