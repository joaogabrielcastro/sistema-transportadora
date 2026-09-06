import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { config } from "../../config/index.js";
import { findOwnedOr404 } from "./fiscalShared.js";

/** Status do Contrato de Frete (operação), independente do CIOT. */
export const CONTRATO_STATUS = Object.freeze({
  RASCUNHO: "rascunho",
  ATIVO: "ativo",
  EM_ANDAMENTO: "em_andamento",
  CONCLUIDO: "concluido",
  CANCELADO: "cancelado",
});

/** Status do registro de CIOT (ANTT/provedor). */
export const CIOT_STATUS = Object.freeze({
  NAO_REGISTRADO: "nao_registrado",
  REGISTRANDO: "registrando",
  REGISTRADO: "registrado",
  ERRO: "erro",
  CANCELADO: "cancelado",
  ENCERRADO: "encerrado",
});

const STATUS_CIOT_SET = new Set(Object.values(CIOT_STATUS));
const STATUS_CONTRATO_SET = new Set(Object.values(CONTRATO_STATUS));

/** Alias legado da API antiga (CIOT.status = declarado). */
const ALIAS_STATUS_CIOT = Object.freeze({
  declarado: CIOT_STATUS.REGISTRADO,
  pendente: CIOT_STATUS.REGISTRANDO,
});

export function normalizarStatusCiot(status) {
  if (!status) return null;
  const s = String(status);
  return ALIAS_STATUS_CIOT[s] || (STATUS_CIOT_SET.has(s) ? s : null);
}

export function isStatusContrato(status) {
  return STATUS_CONTRATO_SET.has(String(status || ""));
}

export function isStatusCiot(status) {
  return Boolean(normalizarStatusCiot(status));
}

export function ciotNumero(ciot) {
  const n = String(ciot?.codigo_identificacao_operacao ?? "").replace(/\D/g, "");
  return n || "";
}

export function ciotEstaRegistrado(ciot) {
  return (
    ciot?.status === CIOT_STATUS.REGISTRADO && Boolean(ciotNumero(ciot))
  );
}

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

export function nomeProvedorCiot() {
  const raw = (config.fiscal.ciotProvider || "").trim();
  return raw || "antt";
}

/**
 * Serializa o registro de CIOT (nunca mistura com status do contrato).
 */
export function serializeCiot(ciot) {
  if (!ciot) return null;
  const s = serializePrisma(ciot);
  return {
    id: s.id,
    contrato_frete_id: s.contrato_frete_id,
    numero: s.codigo_identificacao_operacao ?? null,
    codigo_identificacao_operacao: s.codigo_identificacao_operacao ?? null,
    status: s.status,
    provider: s.provider,
    external_id: s.external_id ?? null,
    protocolo: s.protocolo ?? null,
    id_operacao_transporte: s.id_operacao_transporte,
    codigo_verificador: s.codigo_verificador ?? null,
    registered_at: s.registered_at ?? null,
    cancelled_at: s.cancelled_at ?? null,
    error_code: s.error_code ?? null,
    error_message: s.error_message ?? null,
    response_data: s.response_data ?? null,
    criado_em: s.criado_em,
    atualizado_em: s.atualizado_em ?? null,
  };
}

/**
 * Contrato + CIOT aninhado. `status` é sempre o do contrato.
 * Campos achatados do CIOT existem só para leitura (número/protocolo), nunca
 * como sinônimo do contrato.
 */
export function serializeContrato(contrato, ciot) {
  const base = serializePrisma(contrato);
  const ciotPub = serializeCiot(ciot);
  return {
    ...base,
    status: contrato.status,
    ciot: ciotPub,
    ciot_status: ciotPub?.status ?? CIOT_STATUS.NAO_REGISTRADO,
    codigo_identificacao_operacao: ciotPub?.numero ?? null,
    id_operacao_transporte: ciotPub?.id_operacao_transporte ?? null,
    protocolo: ciotPub?.protocolo ?? null,
  };
}

/**
 * Resolve o CIOT a usar num CT-e/MDF-e a partir do contrato (preferencial)
 * ou de um número já registrado neste tenant.
 *
 * NÃO cria contrato a partir de um número de CIOT.
 * Se `contrato_frete_id` veio, o CIOT precisa estar registrado.
 * Número avulso ainda encontrado no tenant é vinculado ao contrato correspondente.
 * Número avulso que não está no sistema só é aceito quando exigirCadastrado=false
 * (fluxo legado: CIOT declarado fora deste sistema).
 */
export async function resolverCiotParaDocumento(
  tenantId,
  { contratoFreteId, ciotNumeroInformado, exigirCadastrado = false } = {},
) {
  const numeroInformado = ciotNumeroInformado
    ? String(ciotNumeroInformado).replace(/\D/g, "")
    : "";

  if (contratoFreteId != null && contratoFreteId !== "") {
    const contrato = await findOwnedOr404(
      "fiscal_contratos_frete",
      contratoFreteId,
      tenantId,
      "Contrato de frete",
    );
    const ciot = await prisma.fiscal_ciots.findFirst({
      where: {
        contrato_frete_id: contrato.id,
        tenant_id: Number(tenantId),
      },
    });
    if (!ciotEstaRegistrado(ciot)) {
      throw badRequest(
        "O contrato de frete selecionado ainda não possui CIOT registrado. " +
          "Registre o CIOT da operação antes de usá-lo no CT-e ou MDF-e.",
      );
    }
    const numero = ciotNumero(ciot);
    if (numeroInformado && numeroInformado !== numero) {
      throw badRequest(
        "O número de CIOT informado não corresponde ao CIOT registrado neste contrato de frete.",
      );
    }
    return { contrato_frete_id: contrato.id, antt_ciot: numero };
  }

  if (numeroInformado) {
    const ciot = await prisma.fiscal_ciots.findFirst({
      where: {
        tenant_id: Number(tenantId),
        codigo_identificacao_operacao: numeroInformado,
        status: CIOT_STATUS.REGISTRADO,
      },
    });
    if (ciot) {
      return {
        contrato_frete_id: ciot.contrato_frete_id,
        antt_ciot: numeroInformado,
      };
    }
    if (exigirCadastrado) {
      throw badRequest(
        "O CIOT informado não está registrado neste sistema para esta empresa.",
      );
    }
    return { contrato_frete_id: null, antt_ciot: numeroInformado };
  }

  return { contrato_frete_id: null, antt_ciot: null };
}

export async function carregarCiotDoContrato(tenantId, contratoId) {
  return prisma.fiscal_ciots.findFirst({
    where: {
      tenant_id: Number(tenantId),
      contrato_frete_id: Number(contratoId),
    },
  });
}

export async function carregarCiotsPorContratos(tenantId, contratoIds) {
  if (!contratoIds.length) return new Map();
  const rows = await prisma.fiscal_ciots.findMany({
    where: {
      tenant_id: Number(tenantId),
      contrato_frete_id: { in: contratoIds },
    },
  });
  return new Map(rows.map((r) => [r.contrato_frete_id, r]));
}
