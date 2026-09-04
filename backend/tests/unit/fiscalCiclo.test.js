import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.FISCAL_SECRETS_KEY =
  process.env.FISCAL_SECRETS_KEY || "unit-test-fiscal-secrets-key";
process.env.BRASIL_NFE_AMBIENTE = "2";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "fiscal-ciclo-"));
process.env.UPLOADS_DIR = TMP;

const prisma = (await import("../../src/lib/prisma.js")).default;
const { encryptSecret } = await import("../../src/utils/fiscalCrypto.js");
const { BrasilNFeClient } = await import(
  "../../src/services/fiscal/brasilNfe/BrasilNFeClient.js"
);
const { CteService } = await import("../../src/services/fiscal/CteService.js");
const { MdfeService } = await import("../../src/services/fiscal/MdfeService.js");

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

const CHAVE_CTE = "35".padEnd(44, "0");
const CHAVE_MDFE = "58".padEnd(44, "1");
const TOKEN_EMPRESA = "token-empresa-teste";

const payloadCte = {
  cliente_id: 7,
  tipo_cte: "0",
  cfop: "5352",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-09-01T10:00:00-03:00",
  servico: { valor_prestacao: 150 },
  tomador: { cpf_cnpj: "12345678000199" },
  chave_nfe_referenciada: "35240000000000000000000000000000000000000000",
};

function originalsOf(target, names) {
  return Object.fromEntries(names.map((n) => [n, target[n]]));
}

function restore(target, originals) {
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) delete target[name];
    else target[name] = value;
  }
}

const clientOriginals = originalsOf(BrasilNFeClient, [
  "enviarConhecimentoTransporte",
  "enviarManifestoTransporte",
  "obterNotasFiscais",
  "obterArquivoNotaFiscal",
  "cancelarNotaFiscal",
  "encerrarManifestoTransporte",
]);

const transactionOriginal = prisma.$transaction;
const prismaMethodBackup = [];

function stubPrisma(model, method, impl) {
  prismaMethodBackup.push([model, method, prisma[model][method]]);
  prisma[model][method] = impl;
}

afterEach(() => {
  restore(BrasilNFeClient, clientOriginals);
  prisma.$transaction = transactionOriginal;
  while (prismaMethodBackup.length) {
    const [model, method, orig] = prismaMethodBackup.pop();
    prisma[model][method] = orig;
  }
});

function empresaRow(tenantId = 1) {
  return {
    id: 9,
    tenant_id: tenantId,
    cnpj: "11222333000181",
    razao_social: "Transportes Teste",
    crt: 1,
    inscricao_estadual: "123",
    ativo: true,
    cte_mdfe_provider_token: encryptSecret(TOKEN_EMPRESA),
    resp_tec_cnpj: null,
    resp_tec_csrt: null,
  };
}

function stubChildrenEmpty() {
  const empty = async () => [];
  stubPrisma("fiscal_cte_documentos", "findMany", empty);
  stubPrisma("fiscal_cte_carga_quantidades", "findMany", empty);
  stubPrisma("fiscal_cte_componentes_frete", "findMany", empty);
  stubPrisma("fiscal_cte_participantes", "findMany", empty);
  stubPrisma("fiscal_cte_aut_xml", "findMany", empty);
  const none = async () => ({ count: 0 });
  stubPrisma("fiscal_cte_documentos", "createMany", none);
  stubPrisma("fiscal_cte_carga_quantidades", "createMany", none);
  stubPrisma("fiscal_cte_componentes_frete", "createMany", none);
  stubPrisma("fiscal_cte_participantes", "createMany", none);
  stubPrisma("fiscal_cte_aut_xml", "createMany", none);
}

function stubEmpresa(tenantId = 1) {
  const empresa = empresaRow(tenantId);
  stubPrisma("fiscal_empresas", "findFirst", async ({ where }) => {
    if (Number(where.tenant_id) !== tenantId) return null;
    if (where.id != null && Number(where.id) !== empresa.id) return null;
    return empresa;
  });
  stubPrisma("fiscal_empresas", "findMany", async ({ where }) => {
    if (Number(where.tenant_id) !== tenantId) return [];
    return [empresa];
  });
  return empresa;
}

function stubClaim(table, row) {
  prisma.$transaction = async (fn) =>
    fn({
      $queryRaw: async () => [row],
      fiscal_ctes: {
        update: async ({ data }) => {
          Object.assign(row, data);
          return row;
        },
      },
      fiscal_mdfes: {
        update: async ({ data }) => {
          Object.assign(row, data);
          return row;
        },
      },
    });
}

describe("CT-e ciclo com Brasil NFe mockada", () => {
  beforeEach(() => {
    stubChildrenEmpty();
  });

  it("consultarStatus reconcilia autorização e baixa XML", async () => {
    const row = {
      id: 12,
      tenant_id: 1,
      status: "processando",
      chave_acesso: null,
      brasil_nfe_id: "cte-12",
      fiscal_empresa_id: 9,
      xml_path: null,
      cliente_id: 7,
      payload_json: payloadCte,
      criado_em: new Date(),
    };
    stubPrisma("fiscal_ctes", "findFirst", async ({ where }) => {
      if (Number(where.tenant_id) !== 1 || Number(where.id) !== 12) return null;
      return row;
    });
    stubPrisma("fiscal_ctes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubEmpresa(1);
    let notasCalls = 0;
    BrasilNFeClient.obterNotasFiscais = async (body, token) => {
      notasCalls += 1;
      assert.equal(token, TOKEN_EMPRESA);
      assert.equal(body.IdentificadorInterno, "cte-12");
      assert.equal(body.TipoDocumentoFiscal, 1);
      return {
        Notas: [
          {
            chave: CHAVE_CTE,
            Situacao: "autorizado",
            numero: 88,
            serie: 1,
            NuProtocolo: "135000",
          },
        ],
      };
    };
    BrasilNFeClient.obterArquivoNotaFiscal = async () =>
      Buffer.from("<cte/>").toString("base64");

    const result = await CteService.consultarStatus(1, 12);
    assert.equal(notasCalls, 1);
    assert.equal(result.status, "processado");
    assert.equal(result.chave_acesso, CHAVE_CTE);
    assert.equal(result.numero_protocolo, "135000");
    assert.equal(result.consulta.origem, "brasil_nfe");
    assert.equal(result.consulta.xml_disponivel, true);
  });

  it("consultarStatus isola por tenant", async () => {
    stubPrisma("fiscal_ctes", "findFirst", async () => null);
    await assert.rejects(() => CteService.consultarStatus(99, 12), /não encontrado/i);
  });

  it("emitirPorId não reenvia se processando já tem identificador — consulta", async () => {
    const row = {
      id: 4,
      tenant_id: 1,
      status: "processando",
      chave_acesso: CHAVE_CTE,
      brasil_nfe_id: "cte-4",
      fiscal_empresa_id: 9,
      xml_path: "fiscal/cte/1/x.xml",
      cliente_id: 7,
      payload_json: payloadCte,
      criado_em: new Date(),
    };
    stubClaim("fiscal_ctes", { ...row });
    stubPrisma("fiscal_ctes", "findFirst",  async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return row;
    });
    stubPrisma("fiscal_ctes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubEmpresa(1);
    let envios = 0;
    BrasilNFeClient.enviarConhecimentoTransporte = async () => {
      envios += 1;
      return { status: 0, chave: CHAVE_CTE };
    };
    BrasilNFeClient.obterNotasFiscais = async () => ({
      Notas: [{ chave: CHAVE_CTE, Situacao: "autorizado" }],
    });
    BrasilNFeClient.obterArquivoNotaFiscal = async () => null;

    const result = await CteService.emitirPorId(1, 4);
    assert.equal(envios, 0);
    assert.equal(result.status, "processado");
  });

  it("emitir autoriza e segundo emitir é idempotente", async () => {
    const row = {
      id: 5,
      tenant_id: 1,
      status: "rascunho",
      chave_acesso: null,
      brasil_nfe_id: null,
      fiscal_empresa_id: 9,
      xml_path: null,
      cliente_id: 7,
      payload_json: payloadCte,
      emissao_iniciada_em: null,
      criado_em: new Date(),
    };
    stubClaim("fiscal_ctes", row);
    stubPrisma("fiscal_ctes", "findFirst",  async ({ where }) => {
      if (Number(where.tenant_id) !== 1 || Number(where.id) !== 5) return null;
      return row;
    });
    stubPrisma("fiscal_ctes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubPrisma("fiscal_clientes", "findFirst",  async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return { id: 7, tenant_id: 1, cnpj_cpf: "12345678000199" };
    });
    stubEmpresa(1);
    let envios = 0;
    BrasilNFeClient.enviarConhecimentoTransporte = async (body, token) => {
      envios += 1;
      assert.equal(token, TOKEN_EMPRESA);
      assert.equal(body.ModeloDocumento, 57);
      assert.equal(body.TipoCte, 0);
      assert.equal(body.Cfop, 5352);
      return {
        status: 0,
        chave: CHAVE_CTE,
        numero: 10,
        serie: 1,
        protocolo: "p1",
        base64Xml: Buffer.from("<cte/>").toString("base64"),
      };
    };

    const first = await CteService.emitirPorId(1, 5);
    assert.equal(first.status, "processado");
    assert.equal(envios, 1);

    const second = await CteService.emitirPorId(1, 5);
    assert.equal(second.status, "processado");
    assert.equal(envios, 1);
  });

  it("emitir persiste rejeição da SEFAZ", async () => {
    const row = {
      id: 6,
      tenant_id: 1,
      status: "rascunho",
      chave_acesso: null,
      brasil_nfe_id: null,
      fiscal_empresa_id: 9,
      xml_path: null,
      cliente_id: 7,
      payload_json: payloadCte,
      emissao_iniciada_em: null,
      criado_em: new Date(),
    };
    stubClaim("fiscal_ctes", row);
    stubPrisma("fiscal_ctes", "findFirst", async () => row);
    stubPrisma("fiscal_ctes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubPrisma("fiscal_clientes", "findFirst", async () => ({
      id: 7,
      tenant_id: 1,
      cnpj_cpf: "12345678000199",
    }));
    stubEmpresa(1);
    BrasilNFeClient.enviarConhecimentoTransporte = async () => ({
      status: 2,
      erros: ["Rejeição 204"],
      DsMotivo: "Rejeição 204",
    });

    await assert.rejects(() => CteService.emitirPorId(1, 6), /204|rejeit/i);
    assert.equal(row.status, "rejeitado");
  });

  it("cancelar CT-e autorizado chama CancelarNotaFiscal", async () => {
    const row = {
      id: 8,
      tenant_id: 1,
      status: "processado",
      chave_acesso: CHAVE_CTE,
      numero_protocolo: "p1",
      fiscal_empresa_id: 9,
      autorizado_em: new Date(),
      data_emissao: new Date(),
    };
    stubPrisma("fiscal_ctes", "findFirst", async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return row;
    });
    stubPrisma("fiscal_ctes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubEmpresa(1);
    BrasilNFeClient.cancelarNotaFiscal = async (body, token) => {
      assert.equal(token, TOKEN_EMPRESA);
      assert.equal(body.ChaveNF, CHAVE_CTE);
      assert.match(body.Justificativa, /erro de digitação/i);
      return { Status: 1, NuProtocolo: "canc-1" };
    };

    const result = await CteService.cancelar(1, 8, "erro de digitação no tomador");
    assert.equal(result.status, "cancelado");
    assert.equal(row.cancelado_protocolo, "canc-1");
  });
});

describe("MDF-e ciclo com Brasil NFe mockada", () => {
  it("status 2 permanece processando; consultar promove a autorizado", async () => {
    const row = {
      id: 3,
      tenant_id: 1,
      status: "rascunho",
      chave_acesso: null,
      brasil_nfe_id: null,
      fiscal_empresa_id: 9,
      xml_path: null,
      payload_json: {
        caminhao_id: 20,
        uf_carregamento: "SP",
        uf_descarregamento: "RJ",
        data_emissao: "2026-09-01T10:00:00-03:00",
        rodoviario: {
          condutores: [{ nome: "Joao Motorista", cpf: "12345678901" }],
        },
        cte_ids: [],
        resp_seg: 1,
      },
      emissao_iniciada_em: null,
      criado_em: new Date(),
    };
    stubClaim("fiscal_mdfes", row);
    stubPrisma("fiscal_mdfes", "findFirst",  async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return row;
    });
    stubPrisma("fiscal_mdfes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubPrisma("caminhoes", "findFirst",  async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return { id: 20, placa: "ABC1D23", tipo_veiculo: "truck" };
    });
    stubEmpresa(1);
    let envios = 0;
    BrasilNFeClient.enviarManifestoTransporte = async () => {
      envios += 1;
      return { status: 2, chave: CHAVE_MDFE };
    };

    const waiting = await MdfeService.emitirPorId(1, 3);
    assert.equal(waiting.status, "processando");
    assert.equal(waiting.brasil_nfe_id, "mdfe-3");
    assert.equal(envios, 1);

    BrasilNFeClient.obterNotasFiscais = async (body) => {
      assert.equal(body.IdentificadorInterno, "mdfe-3");
      return {
        Notas: [
          {
            chave: CHAVE_MDFE,
            Situacao: "autorizado",
            NuProtocolo: "mdfe-prot",
          },
        ],
      };
    };
    BrasilNFeClient.obterArquivoNotaFiscal = async () =>
      Buffer.from("<mdfe/>").toString("base64");

    const consultado = await MdfeService.consultarStatus(1, 3);
    assert.equal(consultado.status, "processado");
    assert.equal(consultado.numero_protocolo, "mdfe-prot");

    const again = await MdfeService.emitirPorId(1, 3);
    assert.equal(again.status, "processado");
    assert.equal(envios, 1);
  });

  it("encerrar MDF-e autorizado", async () => {
    const row = {
      id: 11,
      tenant_id: 1,
      status: "processado",
      chave_acesso: CHAVE_MDFE,
      numero_protocolo: "mdfe-prot",
      fiscal_empresa_id: 9,
    };
    stubPrisma("fiscal_mdfes", "findFirst", async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return row;
    });
    stubPrisma("fiscal_mdfes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubEmpresa(1);
    BrasilNFeClient.encerrarManifestoTransporte = async (body, token) => {
      assert.equal(token, TOKEN_EMPRESA);
      assert.equal(body.chave, CHAVE_MDFE);
      return { Status: 1, NuProtocolo: "enc-1" };
    };

    const result = await MdfeService.encerrar(1, 11, {
      uf: "RJ",
      codigo_municipio: "3304557",
    });
    assert.equal(result.status, "encerrado");
    assert.equal(row.encerrado_uf, "RJ");
  });

  it("cancelar MDF-e autorizado", async () => {
    const row = {
      id: 15,
      tenant_id: 1,
      status: "processado",
      chave_acesso: CHAVE_MDFE,
      numero_protocolo: "mdfe-prot",
      fiscal_empresa_id: 9,
      autorizado_em: new Date(),
      data_emissao: new Date(),
    };
    stubPrisma("fiscal_mdfes", "findFirst", async ({ where }) => {
      if (Number(where.tenant_id) !== 1) return null;
      return row;
    });
    stubPrisma("fiscal_mdfes", "update",  async ({ data }) => {
      Object.assign(row, data);
      return row;
    });
    stubEmpresa(1);
    BrasilNFeClient.cancelarNotaFiscal = async () => ({
      Status: 1,
      NuProtocolo: "canc-mdfe",
    });
    const result = await MdfeService.cancelar(
      1,
      15,
      "viagem não será realizada",
    );
    assert.equal(result.status, "cancelado");
  });

  it("MDF-e de outro tenant não é encontrado", async () => {
    stubPrisma("fiscal_mdfes", "findFirst", async () => null);
    await assert.rejects(() => MdfeService.consultarStatus(2, 3), /não encontrado/i);
  });
});
