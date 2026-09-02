import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import { emitirCteSchema } from "../../schemas/fiscalSchema.js";
import { CteMdfeProviderClient } from "./CteMdfeProviderClient.js";
import {
  assertTenantFk,
  findOwnedOr404,
  resolveEmpresaCteMdfe,
  salvarPdfBase64,
  salvarXmlBase64,
} from "./fiscalShared.js";

const MODELO_DOCUMENTO_CTE = "57";

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

/**
 * Traduz o DTO (snake_case, convenção ATrack) para o payload do provedor de
 * CT-e/MDF-e (PascalCase). Só os campos que o service usa são conhecidos; os blocos
 * fiscais aninhados (modal/carga/imposto/participantes) são repassados como
 * vieram — mantém o módulo mínimo sem travar emissão.
 */
/**
 * Monta o bloco Carga: repassa o que veio no DTO e, se houver
 * `chave_nfe_referenciada`, acrescenta a NF-e transportada em
 * `Documentos[].Chave` (grupo esperado pelo provedor — mesmo campo
 * `carga.documentos[].chave` do DTO de origem).
 */
export function montarCarga(dto) {
  const base = dto.carga ? { ...dto.carga } : undefined;
  const chave = dto.chave_nfe_referenciada;
  if (!chave) return base;
  const carga = base ?? {};
  const documentos = Array.isArray(carga.documentos)
    ? [...carga.documentos]
    : [];
  documentos.push({ chave });
  return { ...carga, documentos };
}

/**
 * Traduz o DTO para o payload do provedor. `chaveReferenciada` é a chave de
 * acesso do CT-e original (Complemento/Substituto), quando aplicável.
 *
 * OBS: o nome exato do campo do CT-e referenciado no JSON do provedor NÃO foi
 * confirmado em sandbox (ver relatório) — enviado como `ChaveCteReferenciado`.
 */
export function montarPayloadCte(dto, chaveReferenciada) {
  return {
    ModeloDocumento: MODELO_DOCUMENTO_CTE,
    TipoAmbiente: config.fiscal.ambiente,
    TipoCte: dto.tipo_cte,
    ChaveCteReferenciado: chaveReferenciada ?? undefined,
    Cfop: dto.cfop,
    NaturezaOperacao: dto.natureza_operacao,
    DtEmissao: dto.dt_emissao,
    Modal: dto.modal ?? undefined,
    Carga: montarCarga(dto),
    Imposto: dto.imposto ?? undefined,
    Servico: dto.servico ?? undefined,
    Tomador: dto.tomador,
    Destinatario: dto.destinatario ?? undefined,
    Remetente: dto.remetente ?? undefined,
    Expedidor: dto.expedidor ?? undefined,
  };
}

export class CteService {
  static async list(tenantId, { status } = {}) {
    const where = { tenant_id: Number(tenantId) };
    if (status) where.status = String(status);
    const rows = await prisma.fiscal_ctes.findMany({
      where,
      orderBy: { criado_em: "desc" },
    });
    return serializePrisma(rows);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");
    return serializePrisma(row);
  }

  static async emitir(tenantId, body) {
    const dto = emitirCteSchema.parse(body);

    const cliente = await findOwnedOr404(
      "fiscal_clientes",
      dto.cliente_id,
      tenantId,
      "Cliente",
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

    // Complemento (1) / Substituto (3): confirma o CT-e original no mesmo tenant.
    let chaveReferenciada;
    let cteReferenciadoId = null;
    if (dto.tipo_cte === "1" || dto.tipo_cte === "3") {
      const original = await findOwnedOr404(
        "fiscal_ctes",
        dto.cte_referenciado_id,
        tenantId,
        "CT-e referenciado",
      );
      if (original.status !== "processado") {
        throw badRequest(
          "O CT-e referenciado precisa estar com status \"processado\" para receber Complemento ou Substituto.",
        );
      }
      chaveReferenciada = original.chave_acesso;
      cteReferenciadoId = original.id;
    }

    if (dto.tomador.cpf_cnpj !== cliente.cnpj_cpf) {
      throw badRequest(
        "O CNPJ/CPF do tomador não corresponde ao cliente vinculado (cliente_id).",
      );
    }

    const { empresa, token } = await resolveEmpresaCteMdfe(
      tenantId,
      dto.fiscal_empresa_id,
    );

    const resposta = await CteMdfeProviderClient.enviarConhecimentoTransporte(
      montarPayloadCte(dto, chaveReferenciada),
      token,
    );

    // status === 2 => rejeitado pelo provedor (mesmo contrato do jwsoft).
    if (resposta?.status === 2) {
      throw badRequest("Provedor de CT-e/MDF-e rejeitou a emissão do CT-e", {
        erros: resposta.erros ?? [],
      });
    }
    if (!resposta?.chave) {
      throw badRequest(
        "Provedor de CT-e/MDF-e não retornou a chave de acesso do CT-e",
        { resposta },
      );
    }

    // A partir daqui o CT-e já foi emitido de verdade na SEFAZ (irreversível).
    // O registro local precisa existir ANTES de qualquer passo que possa falhar
    // (gravação de arquivo em disco); caso contrário a emissão real ficaria sem
    // rastro e uma nova tentativa geraria um documento duplicado.
    const cte = await prisma.fiscal_ctes.create({
      data: {
        tenant_id: Number(tenantId),
        fiscal_empresa_id: empresa.id,
        cliente_id: cliente.id,
        caminhao_id: caminhaoId,
        motorista_id: motoristaId,
        cte_referenciado_id: cteReferenciadoId,
        chave_acesso: resposta.chave,
        status: "processado",
        numero: resposta.numero != null ? String(resposta.numero) : null,
        serie: resposta.serie != null ? String(resposta.serie) : null,
        data_emissao: new Date(),
        valor_frete: dto.servico?.valor_prestacao ?? null,
      },
    });

    // CT-e já emitido com sucesso — uma falha ao gravar/registrar o XML/PDF não
    // invalida o documento. Loga e segue, sem transformar erro de disco em erro
    // de emissão para o usuário; os arquivos podem ser reobtidos depois.
    let cteComArquivos = cte;
    try {
      const [xmlPath, pdfPath] = await Promise.all([
        salvarXmlBase64("cte", tenantId, resposta.chave, resposta.base64Xml),
        salvarPdfBase64("cte", tenantId, resposta.chave, resposta.base64DACTe),
      ]);
      if (xmlPath || pdfPath) {
        cteComArquivos = await prisma.fiscal_ctes.update({
          where: { id: cte.id },
          data: { xml_path: xmlPath, pdf_path: pdfPath },
        });
      }
    } catch (err) {
      logger.error("Falha ao gravar XML/PDF do CT-e recém-emitido", {
        tenantId,
        cteId: cte.id,
        chave: resposta.chave,
        message: err.message,
      });
    }

    logger.info("CT-e emitido", { tenantId, chave: cteComArquivos.chave_acesso });
    return {
      ...serializePrisma(cteComArquivos),
      base64DACTe: resposta.base64DACTe ?? null,
    };
  }

  static async cancelar(tenantId, id, justificativa) {
    const cte = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");

    // Usa a empresa fiscal registrada na emissão do CT-e; se a linha for antiga
    // e não tiver fiscal_empresa_id, cai na resolução da única empresa ativa.
    const { token } = await resolveEmpresaCteMdfe(
      tenantId,
      cte.fiscal_empresa_id ?? undefined,
    );

    const resposta = await CteMdfeProviderClient.cancelarNotaFiscal(
      {
        ChaveNF: cte.chave_acesso,
        Justificativa: justificativa,
        DataEvento: new Date().toISOString(),
      },
      token,
    );

    if (resposta?.Status === 3) {
      throw badRequest(
        resposta.Error ??
          "Provedor de CT-e/MDF-e rejeitou o cancelamento do CT-e",
      );
    }
    // Status === 2 => aguardando SEFAZ; mantém status atual até nova tentativa.
    if (resposta?.Status === 2) {
      return serializePrisma(cte);
    }

    const updated = await prisma.fiscal_ctes.update({
      where: { id: cte.id },
      data: { status: "cancelado" },
    });
    return serializePrisma(updated);
  }

  /** Vincula (ou desvincula) o CT-e a um MDF-e do mesmo tenant. */
  static async vincularManifesto(tenantId, id, manifestoId) {
    const cte = await findOwnedOr404("fiscal_ctes", id, tenantId, "CT-e");
    const linkId =
      manifestoId == null
        ? null
        : await assertTenantFk(
            "fiscal_mdfes",
            manifestoId,
            tenantId,
            "MDF-e",
          );
    const updated = await prisma.fiscal_ctes.update({
      where: { id: cte.id },
      data: { manifesto_id: linkId },
    });
    return serializePrisma(updated);
  }
}
