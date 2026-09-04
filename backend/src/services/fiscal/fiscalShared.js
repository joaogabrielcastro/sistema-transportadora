import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../../lib/prisma.js";
import { UPLOADS_ROOT } from "../../utils/uploadPaths.js";
import { decryptSecret } from "../../utils/fiscalCrypto.js";
import { avaliarClaimEmissao, CTE_STATUS } from "./fiscalStatus.js";

/** Raiz dos XML de documentos fiscais de transporte (mesmo padrão de arquivo das NF-e de compra). */
const FISCAL_XML_ROOT = path.join(UPLOADS_ROOT, "fiscal");

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

/**
 * Monta o grupo `seguros` (seg do MDF-e / CT-e). Extraído do MdfeService (item
 * 1.6) para ser reaproveitado pelo CteService — o comportamento para o MDF-e é
 * idêntico ao anterior: se `dto.seguros` (array livre) veio, respeita; senão
 * monta uma entrada a partir dos campos planos.
 *
 * resp_seg / indicadorResponsavel: no MDF-e 1 = emitente do MDF-e, 2 =
 * contratante. No CT-e o CteService faz o de-para do seu objeto `seg` aninhado
 * para estes mesmos nomes de campo antes de chamar aqui.
 *
 * `nomeSegurador` / `xSeg` NÃO entra no payload (mantido como estava no MDF-e);
 * o nome da seguradora é só persistido em coluna. Confirmar em sandbox se o
 * provedor exige.
 */
// Número sequencial do evento (nSeqEvento). O primeiro evento de
// encerramento/cancelamento é sempre 1; retificação / múltiplos eventos
// (nSeqEvento > 1) ainda não são modelados — fica como follow-up.
export const EVENTO_PRIMEIRO_SEQUENCIAL = 1;

/**
 * Corpo do cancelamento genérico do provedor — CT-e e MDF-e usam o MESMO
 * endpoint (item 0.6). Campos confirmados no payload real: ChaveNF,
 * Justificativa, NumeroProtocolo, NumeroSequencial, DataEvento e
 * CpfCnpjRemetenteDCe (o CNPJ do emitente/tenant). `protocolo` e
 * `cnpjRemetente` podem faltar (ex.: CT-e sem protocolo persistido) — nesse
 * caso a chave sai como undefined e o provedor resolve pela ChaveNF.
 */
/**
 * Extrai o número do protocolo de autorização da resposta de emissão do provedor
 * (CT-e e MDF-e usam o mesmo contrato de resposta). O nome exato do campo não
 * está confirmado em sandbox — tenta as grafias plausíveis (o
 * cancelamento/encerramento do MDF-e devolve `NuProtocolo`; o CIOT usa
 * `Protocolo`). Devolve `null` quando nenhuma aparece, e nesse caso o
 * cancelamento resolve o documento só pela chave de acesso.
 */
export function extrairNumeroProtocolo(resposta) {
  const bruto =
    resposta?.protocolo ??
    resposta?.Protocolo ??
    resposta?.numeroProtocolo ??
    resposta?.NumeroProtocolo ??
    resposta?.NuProtocolo ??
    resposta?.nProt ??
    null;
  return bruto != null ? String(bruto) : null;
}

export function montarPayloadCancelamento({
  chave,
  justificativa,
  protocolo,
  cnpjRemetente,
}) {
  return {
    ChaveNF: chave ?? undefined,
    Justificativa: justificativa,
    NumeroProtocolo: protocolo ?? undefined,
    NumeroSequencial: EVENTO_PRIMEIRO_SEQUENCIAL,
    DataEvento: new Date().toISOString(),
    CpfCnpjRemetenteDCe: cnpjRemetente ?? undefined,
  };
}

export function montarGrupoSeguro(dto) {
  if (Array.isArray(dto.seguros) && dto.seguros.length > 0) return dto.seguros;
  if (
    dto.resp_seg == null &&
    dto.cnpj_seguradora == null &&
    dto.numero_apolice == null &&
    dto.numero_averbacao == null
  ) {
    return undefined;
  }
  return [
    {
      indicadorResponsavel: dto.resp_seg ?? undefined,
      cnpjSegurador: dto.cnpj_seguradora ?? undefined,
      numeroApolice: dto.numero_apolice ?? undefined,
      numerosAverbacao: dto.numero_averbacao ? [dto.numero_averbacao] : undefined,
    },
  ];
}

/**
 * Revalida que um id de FK cruzada pertence ao MESMO tenant antes de usar.
 * Mesmo princípio de CaminhaoService.applyMotoristaLink / NotaFiscalService.resolveCaminhaoId.
 *
 * @param {"caminhoes"|"motoristas"|"fiscal_clientes"|"fiscal_empresas"|"fiscal_mdfes"} model
 * @param {number|null|undefined} id
 * @param {number} tenantId
 * @param {string} label rótulo para a mensagem de erro
 * @param {{ optional?: boolean }} [opts]
 * @returns {Promise<number|null>}
 */
export async function assertTenantFk(model, id, tenantId, label, opts = {}) {
  if (id == null || id === "") {
    if (opts.optional) return null;
    throw badRequest(`${label} é obrigatório`);
  }
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    throw badRequest(`${label} inválido`);
  }
  const row = await prisma[model].findFirst({
    where: { id: numId, tenant_id: Number(tenantId) },
    select: { id: true },
  });
  if (!row) {
    throw badRequest(`${label} não encontrado neste tenant`);
  }
  return row.id;
}

/**
 * FKs opcionais de rascunho CT-e/MDF-e (empresa, caminhão, motorista).
 * Impede gravar id de outro tenant no draft.
 */
export async function assertFksVeiculoEmpresa(tenantId, dto = {}) {
  const fiscalEmpresaId = await assertTenantFk(
    "fiscal_empresas",
    dto.fiscal_empresa_id,
    tenantId,
    "Empresa fiscal",
    { optional: true },
  );
  const caminhaoId = await assertTenantFk(
    "caminhoes",
    dto.caminhao_id,
    tenantId,
    "Caminhão",
    { optional: true },
  );
  const motoristaId = await assertTenantFk(
    "motoristas",
    dto.motorista_id,
    tenantId,
    "Motorista",
    { optional: true },
  );
  return { fiscalEmpresaId, caminhaoId, motoristaId };
}

/** Igual a assertTenantFk mas lança 404 (para o recurso principal buscado por id). */
export async function findOwnedOr404(model, id, tenantId, label) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    throw notFound(`${label} não encontrado`);
  }
  const row = await prisma[model].findFirst({
    where: { id: numId, tenant_id: Number(tenantId) },
  });
  if (!row) {
    throw notFound(`${label} não encontrado`);
  }
  return row;
}

/**
 * Decodifica um conteúdo em base64 e grava em disco sob
 * uploads/fiscal/<tipo>/<tenant>/<chave>.<ext>. Retorna o caminho RELATIVO a
 * UPLOADS_ROOT (o que vai para *.xml_path / *.pdf_path), igual ao padrão de
 * xml_path/pdf_path das notas_fiscais.
 *
 * @param {string} tipo "cte" | "mdfe"
 * @param {number} tenantId
 * @param {string} chave chave de acesso (nome do arquivo)
 * @param {string} base64 conteúdo em base64 devolvido pelo provedor
 * @param {"xml"|"pdf"} ext extensão do arquivo (define binário x texto)
 * @returns {Promise<string|null>}
 */
async function salvarArquivoBase64(tipo, tenantId, chave, base64, ext) {
  if (!base64) return null;
  const safeChave = String(chave || `${Date.now()}`).replace(/[^0-9A-Za-z_-]/g, "");
  const relDir = path.join("fiscal", tipo, String(tenantId));
  const absDir = path.join(FISCAL_XML_ROOT, tipo, String(tenantId));
  await fs.mkdir(absDir, { recursive: true });
  const relPath = path.join(relDir, `${safeChave}.${ext}`);
  const absPath = path.join(UPLOADS_ROOT, relPath);
  const buf = Buffer.from(base64, "base64");
  // XML é conteúdo textual (decodifica p/ utf8, igual às NF-e de compra);
  // PDF (DACTE/DAMDFE) é binário e é gravado como veio.
  await fs.writeFile(absPath, ext === "xml" ? buf.toString("utf8") : buf, {
    encoding: ext === "xml" ? "utf8" : undefined,
  });
  return relPath.split(path.sep).join("/");
}

/** Grava o XML (base64Xml) do documento fiscal. Retorna o caminho relativo ou null. */
export function salvarXmlBase64(tipo, tenantId, chave, base64Xml) {
  return salvarArquivoBase64(tipo, tenantId, chave, base64Xml, "xml");
}

/** Grava o PDF (DACTE/DAMDFE — base64DACTe/base64DAMDFe) do documento fiscal. */
export function salvarPdfBase64(tipo, tenantId, chave, base64Pdf) {
  return salvarArquivoBase64(tipo, tenantId, chave, base64Pdf, "pdf");
}

/**
 * Resolve a empresa fiscal a usar para emitir CT-e/MDF-e e devolve o token do
 * provedor já decifrado. Se `fiscalEmpresaId` não vier, usa a única empresa
 * fiscal ativa do tenant; se houver mais de uma, exige a escolha explícita.
 *
 * @returns {Promise<{ empresa: object, token: string }>}
 */
export async function resolveEmpresaCteMdfe(tenantId, fiscalEmpresaId) {
  let empresa;
  if (fiscalEmpresaId != null && fiscalEmpresaId !== "") {
    empresa = await findOwnedOr404(
      "fiscal_empresas",
      fiscalEmpresaId,
      tenantId,
      "Empresa fiscal",
    );
  } else {
    const ativas = await prisma.fiscal_empresas.findMany({
      where: { tenant_id: Number(tenantId), ativo: true },
    });
    if (ativas.length === 0) {
      throw badRequest(
        "Nenhuma empresa fiscal ativa cadastrada — cadastre o CNPJ emissor antes de emitir.",
      );
    }
    if (ativas.length > 1) {
      throw badRequest(
        "Mais de uma empresa fiscal ativa — informe fiscal_empresa_id para escolher o CNPJ emissor.",
      );
    }
    [empresa] = ativas;
  }

  const token = decryptSecret(empresa.cte_mdfe_provider_token);
  if (!token) {
    throw badRequest(
      "A empresa fiscal selecionada não possui token do provedor de CT-e/MDF-e cadastrado.",
    );
  }
  return { empresa, token };
}

/**
 * Resolve a empresa fiscal para operações de CIOT e devolve o caminho do
 * certificado + a senha decifrada para a conexão mTLS com o provedor de CIOT.
 *
 * @returns {Promise<{ empresa: object, certificado: { pfxPath: string, senha: string } }>}
 */
export async function resolveEmpresaCertificado(tenantId, fiscalEmpresaId) {
  const empresa = await findOwnedOr404(
    "fiscal_empresas",
    fiscalEmpresaId,
    tenantId,
    "Empresa fiscal",
  );
  if (!empresa.certificado_pfx_path || !empresa.certificado_senha) {
    throw badRequest(
      "A empresa fiscal selecionada não possui certificado digital (pfx + senha) configurado para conexão mTLS com o provedor de CIOT.",
    );
  }
  return {
    empresa,
    certificado: {
      pfxPath: empresa.certificado_pfx_path,
      senha: decryptSecret(empresa.certificado_senha),
    },
  };
}

/**
 * Trava a linha (SELECT FOR UPDATE) e marca `processando`.
 * Se já estiver autorizado, devolve alreadyAuthorized para a emissão ser idempotente.
 *
 * @param {"fiscal_ctes"|"fiscal_mdfes"} table
 */
export async function claimEmissao(table, id, tenantId, label) {
  if (table !== "fiscal_ctes" && table !== "fiscal_mdfes") {
    throw new Error("Tabela fiscal inválida para claim de emissão");
  }
  return prisma.$transaction(async (tx) => {
    const rows =
      table === "fiscal_ctes"
        ? await tx.$queryRaw`
            SELECT id, status, emissao_iniciada_em, chave_acesso, brasil_nfe_id
            FROM fiscal_ctes
            WHERE id = ${Number(id)} AND tenant_id = ${Number(tenantId)}
            FOR UPDATE
          `
        : await tx.$queryRaw`
            SELECT id, status, emissao_iniciada_em, chave_acesso, brasil_nfe_id
            FROM fiscal_mdfes
            WHERE id = ${Number(id)} AND tenant_id = ${Number(tenantId)}
            FOR UPDATE
          `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw notFound(`${label} não encontrado`);
    }
    const decision = avaliarClaimEmissao(row);
    if (decision.action === "already_authorized") {
      return { alreadyAuthorized: true, id: Number(row.id) };
    }
    if (decision.action === "consult") {
      return { alreadyAuthorized: false, consultInstead: true, id: Number(row.id) };
    }
    if (decision.action === "reject") throw decision.error;
    await tx[table].update({
      where: { id: Number(row.id) },
      data: {
        status: CTE_STATUS.PROCESSANDO,
        emissao_iniciada_em: new Date(),
      },
    });
    return { alreadyAuthorized: false, id: Number(row.id) };
  });
}
