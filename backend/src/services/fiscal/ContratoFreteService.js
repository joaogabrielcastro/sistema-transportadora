import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { contratoFreteSchema } from "../../schemas/fiscalSchema.js";
import {
  assertTenantFk,
  findOwnedOr404,
} from "./fiscalShared.js";
import {
  calcularRetencoes,
  colunasRntrcSnapshot,
  resolverCategoriaOperacao,
  verificarPisoMinimoFrete,
} from "./ciotDeclaracao.js";
import { config } from "../../config/index.js";
import {
  carregarCiotDoContrato,
  carregarCiotsPorContratos,
  CONTRATO_STATUS,
  CIOT_STATUS,
  isStatusCiot,
  isStatusContrato,
  normalizarStatusCiot,
  serializeContrato,
} from "./ciotOperacao.js";

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

async function assertFksContrato(tenantId, dto) {
  const empresa = await findOwnedOr404(
    "fiscal_empresas",
    dto.fiscal_empresa_id,
    tenantId,
    "Empresa fiscal",
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
  const mdfeId = await assertTenantFk(
    "fiscal_mdfes",
    dto.mdfe_id,
    tenantId,
    "MDF-e",
    { optional: true },
  );
  return { empresa, caminhaoId, motoristaId, mdfeId };
}

export function colunasContratoFromDto(dto, { empresa, caminhaoId, motoristaId, mdfeId }) {
  const retencoes = calcularRetencoes(dto, {
    inssAliquota: config.fiscal.retencaoInssAliquota,
    sestSenatAliquota: config.fiscal.retencaoSestSenatAliquota,
  });
  return {
    fiscal_empresa_id: empresa.id,
    caminhao_id: caminhaoId,
    motorista_id: motoristaId,
    mdfe_id: mdfeId,
    tipo_operacao: dto.tipo_operacao,
    categoria_operacao: resolverCategoriaOperacao(dto),
    cpf_cnpj_contratado: dto.cpf_cnpj_contratado,
    rntrc_contratado: dto.rntrc_contratado,
    cpf_cnpj_contratante: dto.cpf_cnpj_contratante,
    rntrc_contratante: dto.rntrc_contratante ?? null,
    cpf_cnpj_destinatario: dto.cpf_cnpj_destinatario ?? null,
    valor_frete: dto.valor_frete,
    valor_piso_minimo_frete: dto.valor_piso_minimo_frete,
    valor_vale_pedagio: dto.valor_vale_pedagio,
    data_inicio_viagem: dto.data_inicio_viagem
      ? new Date(dto.data_inicio_viagem)
      : null,
    data_fim_viagem: dto.data_fim_viagem
      ? new Date(dto.data_fim_viagem)
      : null,
    origem_destino: dto.origem_destino ?? null,
    dados_carga: dto.dados_carga ?? null,
    carga_ncm: dto.dados_carga?.ncm ?? null,
    veiculos: dto.veiculos,
    inf_pagamento: dto.inf_pagamento,
    inf_indicadores_operacionais: dto.inf_indicadores_operacionais ?? null,
    informacoes_adicionais: dto.informacoes_adicionais ?? null,
    ...colunasRntrcSnapshot(dto),
    ...retencoes,
  };
}

/** Reconstrói o DTO de declaração a partir do contrato persistido. */
export function dtoFromContrato(contrato) {
  return {
    fiscal_empresa_id: contrato.fiscal_empresa_id,
    caminhao_id: contrato.caminhao_id ?? undefined,
    motorista_id: contrato.motorista_id ?? undefined,
    mdfe_id: contrato.mdfe_id ?? undefined,
    tipo_operacao: contrato.tipo_operacao,
    categoria_operacao: contrato.categoria_operacao ?? undefined,
    cpf_cnpj_contratado: contrato.cpf_cnpj_contratado,
    rntrc_contratado: contrato.rntrc_contratado,
    cpf_cnpj_contratante: contrato.cpf_cnpj_contratante,
    rntrc_contratante: contrato.rntrc_contratante ?? undefined,
    cpf_cnpj_destinatario: contrato.cpf_cnpj_destinatario ?? undefined,
    valor_frete: Number(contrato.valor_frete),
    valor_piso_minimo_frete:
      contrato.valor_piso_minimo_frete != null
        ? Number(contrato.valor_piso_minimo_frete)
        : undefined,
    valor_vale_pedagio:
      contrato.valor_vale_pedagio != null
        ? Number(contrato.valor_vale_pedagio)
        : 0,
    data_inicio_viagem: contrato.data_inicio_viagem
      ? new Date(contrato.data_inicio_viagem).toISOString()
      : undefined,
    data_fim_viagem: contrato.data_fim_viagem
      ? new Date(contrato.data_fim_viagem).toISOString()
      : undefined,
    veiculos: contrato.veiculos,
    inf_pagamento: contrato.inf_pagamento,
    origem_destino: contrato.origem_destino ?? undefined,
    dados_carga: contrato.dados_carga ?? undefined,
    inf_indicadores_operacionais:
      contrato.inf_indicadores_operacionais ?? undefined,
    rntrc_contratado_situacao: contrato.rntrc_contratado_situacao ?? undefined,
    rntrc_contratado_snapshot: contrato.rntrc_contratado_snapshot ?? undefined,
  };
}

function contratoEditavel(contrato, ciot) {
  if (contrato.status === CONTRATO_STATUS.CANCELADO) {
    throw badRequest("Não é possível editar um contrato de frete cancelado.");
  }
  if (contrato.status === CONTRATO_STATUS.CONCLUIDO) {
    throw badRequest("Não é possível editar um contrato de frete concluído.");
  }
  if (
    ciot &&
    (ciot.status === CIOT_STATUS.REGISTRADO ||
      ciot.status === CIOT_STATUS.ENCERRADO)
  ) {
    throw badRequest(
      "Não é possível editar o contrato depois que o CIOT foi registrado. Cancele o CIOT primeiro, se a regra permitir.",
    );
  }
}

export class ContratoFreteService {
  static async list(tenantId, { status, ciot_status } = {}) {
    const where = { tenant_id: Number(tenantId) };
    const statusCiotFiltro = normalizarStatusCiot(ciot_status || (!isStatusContrato(status) && isStatusCiot(status) ? status : null));
    if (status && isStatusContrato(status)) {
      where.status = String(status);
    }
    const rows = await prisma.fiscal_contratos_frete.findMany({
      where,
      orderBy: { criado_em: "desc" },
    });
    const ciots = await carregarCiotsPorContratos(
      tenantId,
      rows.map((r) => r.id),
    );
    let result = rows.map((r) => serializeContrato(r, ciots.get(r.id)));
    if (statusCiotFiltro === CIOT_STATUS.NAO_REGISTRADO) {
      result = result.filter((r) => !r.ciot);
    } else if (statusCiotFiltro) {
      result = result.filter((r) => r.ciot?.status === statusCiotFiltro);
    }
    return result;
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404(
      "fiscal_contratos_frete",
      id,
      tenantId,
      "Contrato de frete",
    );
    const ciot = await carregarCiotDoContrato(tenantId, row.id);
    return serializeContrato(row, ciot);
  }

  /**
   * Resolve GET legado /fiscal/ciot/:id — tenta contrato, depois registro de CIOT.
   */
  static async getByIdOuCiot(tenantId, id) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      const err = new Error("Contrato de frete não encontrado");
      err.statusCode = 404;
      throw err;
    }
    const contrato = await prisma.fiscal_contratos_frete.findFirst({
      where: { id: numId, tenant_id: Number(tenantId) },
    });
    if (contrato) {
      const ciot = await carregarCiotDoContrato(tenantId, contrato.id);
      return serializeContrato(contrato, ciot);
    }
    const ciot = await prisma.fiscal_ciots.findFirst({
      where: { id: numId, tenant_id: Number(tenantId) },
    });
    if (!ciot) {
      const err = new Error("Contrato de frete não encontrado");
      err.statusCode = 404;
      throw err;
    }
    const pai = await findOwnedOr404(
      "fiscal_contratos_frete",
      ciot.contrato_frete_id,
      tenantId,
      "Contrato de frete",
    );
    return serializeContrato(pai, ciot);
  }

  static async create(tenantId, body, { status = CONTRATO_STATUS.ATIVO } = {}) {
    const dto = contratoFreteSchema.parse(body);
    verificarPisoMinimoFrete(dto);
    const fks = await assertFksContrato(tenantId, dto);
    const row = await prisma.fiscal_contratos_frete.create({
      data: {
        tenant_id: Number(tenantId),
        status,
        ...colunasContratoFromDto(dto, fks),
      },
    });
    logger.info("Contrato de frete criado", { tenantId, contratoId: row.id });
    return serializeContrato(row, null);
  }

  static async update(tenantId, id, body) {
    const atual = await findOwnedOr404(
      "fiscal_contratos_frete",
      id,
      tenantId,
      "Contrato de frete",
    );
    const ciot = await carregarCiotDoContrato(tenantId, atual.id);
    contratoEditavel(atual, ciot);
    const dto = contratoFreteSchema.parse(body);
    verificarPisoMinimoFrete(dto);
    const fks = await assertFksContrato(tenantId, dto);
    const row = await prisma.fiscal_contratos_frete.update({
      where: { id: atual.id },
      data: colunasContratoFromDto(dto, fks),
    });
    logger.info("Contrato de frete atualizado", { tenantId, contratoId: row.id });
    return serializeContrato(row, ciot);
  }

  static async cancelar(tenantId, id) {
    const atual = await findOwnedOr404(
      "fiscal_contratos_frete",
      id,
      tenantId,
      "Contrato de frete",
    );
    if (atual.status === CONTRATO_STATUS.CANCELADO) {
      throw badRequest("Este contrato de frete já está cancelado.");
    }
    const ciot = await carregarCiotDoContrato(tenantId, atual.id);
    if (
      ciot &&
      (ciot.status === CIOT_STATUS.REGISTRADO ||
        ciot.status === CIOT_STATUS.REGISTRANDO)
    ) {
      throw badRequest(
        "Cancele o CIOT desta operação antes de cancelar o contrato de frete.",
      );
    }
    const row = await prisma.fiscal_contratos_frete.update({
      where: { id: atual.id },
      data: { status: CONTRATO_STATUS.CANCELADO },
    });
    logger.info("Contrato de frete cancelado", { tenantId, contratoId: row.id });
    return serializeContrato(row, ciot);
  }
}
