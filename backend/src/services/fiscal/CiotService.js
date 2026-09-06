import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";
import {
  consultarSituacaoTransportadorSchema,
  contratoFreteSchema,
} from "../../schemas/fiscalSchema.js";
import { somenteDigitos, gerarIdOperacaoUnico } from "../../utils/fiscalDocs.js";
import { CiotProviderClient } from "./CiotProviderClient.js";
import {
  findOwnedOr404,
  resolveEmpresaCertificado,
} from "./fiscalShared.js";
import { resultadoSimulacaoDocumento } from "./fiscalSimulacao.js";
import {
  ContratoFreteService,
  dtoFromContrato,
} from "./ContratoFreteService.js";
import {
  calcularRetencoes,
  CODIGO_SUCESSO_OPERACAO,
  colunasRntrcSnapshot,
  janelaCancelamentoHoras,
  montarPayloadDeclaracao,
  resolverCategoriaOperacao,
  retencoesDoContrato,
  verificarPisoMinimoFrete,
} from "./ciotDeclaracao.js";
import {
  carregarCiotDoContrato,
  CIOT_STATUS,
  CONTRATO_STATUS,
  nomeProvedorCiot,
  serializeContrato,
} from "./ciotOperacao.js";

export {
  calcularRetencoes,
  colunasRntrcSnapshot,
  janelaCancelamentoHoras,
  montarRetencoesPayload,
  resolverCategoriaOperacao,
  verificarPisoMinimoFrete,
} from "./ciotDeclaracao.js";

function badRequest(message, extra) {
  const err = new Error(message);
  err.statusCode = 400;
  if (extra) err.details = extra;
  return err;
}

function validarCnpjCertificado(cnpjEmpresa, contratado, contratante) {
  const cert = somenteDigitos(cnpjEmpresa);
  if (
    cert !== somenteDigitos(contratado) &&
    cert !== somenteDigitos(contratante)
  ) {
    throw badRequest(
      "O CNPJ da empresa fiscal (certificado usado na conexão) precisa ser o contratado ou o contratante da operação",
    );
  }
}

function dtoProntoParaRegistro(contrato, extras = {}) {
  const dto = contratoFreteSchema.parse({
    ...dtoFromContrato(contrato),
    data_declaracao:
      extras.data_declaracao || new Date().toISOString(),
    ...extras,
  });
  verificarPisoMinimoFrete(dto);
  return dto;
}

async function resolverContratoParaCiot(tenantId, id) {
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
    return { contrato, ciot };
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
  return { contrato: pai, ciot };
}

export class CiotService {
  static list(tenantId, opts) {
    return ContratoFreteService.list(tenantId, opts);
  }

  static getById(tenantId, id) {
    return ContratoFreteService.getByIdOuCiot(tenantId, id);
  }

  static async simular(tenantId, body) {
    const contratoId =
      body?.contrato_frete_id != null && body.contrato_frete_id !== ""
        ? Number(body.contrato_frete_id)
        : body?.id != null && body.id !== ""
          ? Number(body.id)
          : null;

    let dto;
    let empresa;
    let retencoes;
    if (Number.isInteger(contratoId) && contratoId > 0) {
      const contrato = await findOwnedOr404(
        "fiscal_contratos_frete",
        contratoId,
        tenantId,
        "Contrato de frete",
      );
      empresa = await findOwnedOr404(
        "fiscal_empresas",
        contrato.fiscal_empresa_id,
        tenantId,
        "Empresa fiscal",
      );
      dto = dtoProntoParaRegistro(contrato, {
        data_declaracao: body?.data_declaracao,
      });
      retencoes = retencoesDoContrato(contrato);
    } else {
      dto = contratoFreteSchema.parse(body);
      empresa = await findOwnedOr404(
        "fiscal_empresas",
        dto.fiscal_empresa_id,
        tenantId,
        "Empresa fiscal",
      );
      validarCnpjCertificado(
        empresa.cnpj,
        dto.cpf_cnpj_contratado,
        dto.cpf_cnpj_contratante,
      );
      verificarPisoMinimoFrete(dto);
      retencoes = calcularRetencoes(dto, {
        inssAliquota: config.fiscal.retencaoInssAliquota,
        sestSenatAliquota: config.fiscal.retencaoSestSenatAliquota,
      });
    }

    const payload = montarPayloadDeclaracao(
      dto,
      "CIOT-SIMULACAO",
      retencoes,
    );
    logger.info("CIOT simulado — não transmitido à ANTT", { tenantId });
    return resultadoSimulacaoDocumento({
      tipo: "ciot",
      documento: {
        status: "simulacao",
        valor_frete: dto.valor_frete,
        categoria_operacao: resolverCategoriaOperacao(dto),
      },
      payload,
      empresa,
    });
  }

  /**
   * Fluxo legado: cria o contrato e registra o CIOT na mesma chamada.
   * Preferir POST /contratos-frete + POST /contratos-frete/:id/ciot.
   */
  static async declarar(tenantId, body) {
    const contrato = await ContratoFreteService.create(tenantId, body, {
      status: CONTRATO_STATUS.ATIVO,
    });
    return this.registrar(tenantId, contrato.id, {
      data_declaracao: body?.data_declaracao,
    });
  }

  static async registrar(tenantId, contratoId, extras = {}) {
    const contrato = await findOwnedOr404(
      "fiscal_contratos_frete",
      contratoId,
      tenantId,
      "Contrato de frete",
    );
    if (contrato.status === CONTRATO_STATUS.CANCELADO) {
      throw badRequest(
        "Não é possível registrar CIOT de um contrato de frete cancelado.",
      );
    }

    let ciot = await carregarCiotDoContrato(tenantId, contrato.id);
    if (
      ciot &&
      (ciot.status === CIOT_STATUS.REGISTRADO ||
        ciot.status === CIOT_STATUS.ENCERRADO)
    ) {
      throw badRequest(
        "Este contrato de frete já possui um CIOT registrado.",
      );
    }

    const dto = dtoProntoParaRegistro(contrato, extras);
    const { empresa, certificado } = await resolveEmpresaCertificado(
      tenantId,
      contrato.fiscal_empresa_id,
    );
    validarCnpjCertificado(
      empresa.cnpj,
      dto.cpf_cnpj_contratado,
      dto.cpf_cnpj_contratante,
    );

    const reusarId =
      ciot &&
      (ciot.status === CIOT_STATUS.ERRO ||
        ciot.status === CIOT_STATUS.REGISTRANDO)
        ? ciot.id_operacao_transporte
        : null;
    const idOperacaoTransporte =
      reusarId ||
      (await gerarIdOperacaoUnico(async (candidato) => {
        const existente = await prisma.fiscal_ciots.findUnique({
          where: { id_operacao_transporte: candidato },
          select: { id: true },
        });
        return Boolean(existente);
      }));

    const retencoes = retencoesDoContrato(contrato);
    const payload = montarPayloadDeclaracao(
      dto,
      idOperacaoTransporte,
      retencoes,
    );

    const dataBase = {
      tenant_id: Number(tenantId),
      contrato_frete_id: contrato.id,
      provider: nomeProvedorCiot(),
      id_operacao_transporte: idOperacaoTransporte,
      status: CIOT_STATUS.REGISTRANDO,
      error_code: null,
      error_message: null,
    };

    if (ciot) {
      ciot = await prisma.fiscal_ciots.update({
        where: { id: ciot.id },
        data: dataBase,
      });
    } else {
      ciot = await prisma.fiscal_ciots.create({ data: dataBase });
    }

    let resposta;
    try {
      resposta = await CiotProviderClient.declararOperacaoTransporte(
        payload,
        certificado,
      );
    } catch (err) {
      await prisma.fiscal_ciots.update({
        where: { id: ciot.id },
        data: {
          status: CIOT_STATUS.ERRO,
          error_message: err.message,
          response_data: { erro: err.message },
        },
      });
      throw err;
    }

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      await prisma.fiscal_ciots.update({
        where: { id: ciot.id },
        data: {
          status: CIOT_STATUS.ERRO,
          error_code:
            resposta?.Codigo != null ? String(resposta.Codigo) : null,
          error_message: resposta?.Mensagem ?? "Provedor rejeitou o registro",
          response_data: resposta ?? null,
        },
      });
      throw badRequest(
        "Provedor de CIOT rejeitou o registro da operação de transporte",
        { codigo: resposta?.Codigo, mensagem: resposta?.Mensagem },
      );
    }

    const registered = await prisma.fiscal_ciots.update({
      where: { id: ciot.id },
      data: {
        status: CIOT_STATUS.REGISTRADO,
        codigo_identificacao_operacao:
          resposta.CodigoIdentificacaoOperacao ?? null,
        codigo_verificador: resposta.CodigoVerificador ?? null,
        protocolo: resposta.Protocolo ?? null,
        external_id:
          resposta.CodigoIdentificacaoOperacao ??
          resposta.Protocolo ??
          null,
        registered_at: new Date(),
        response_data: resposta,
        error_code: null,
        error_message: null,
      },
    });

    await prisma.fiscal_contratos_frete.update({
      where: { id: contrato.id },
      data: { status: CONTRATO_STATUS.EM_ANDAMENTO },
    });

    const atualizado = await prisma.fiscal_contratos_frete.findFirst({
      where: { id: contrato.id, tenant_id: Number(tenantId) },
    });
    logger.info("CIOT registrado", {
      tenantId,
      contratoId: contrato.id,
      id_operacao: registered.id_operacao_transporte,
      ciot: registered.codigo_identificacao_operacao,
      provider: registered.provider,
    });
    return serializeContrato(atualizado, registered);
  }

  static async cancelar(tenantId, id, justificativa) {
    const { contrato, ciot } = await resolverContratoParaCiot(tenantId, id);
    if (!ciot || !ciot.codigo_identificacao_operacao) {
      throw badRequest(
        "Este contrato ainda não possui CIOT registrado para cancelar.",
      );
    }
    if (ciot.status === CIOT_STATUS.CANCELADO) {
      throw badRequest("Este CIOT já está cancelado.");
    }
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      contrato.fiscal_empresa_id,
    );

    const janelaHoras = janelaCancelamentoHoras(contrato.categoria_operacao);
    const prazoLimite = new Date(contrato.data_inicio_viagem);
    prazoLimite.setHours(prazoLimite.getHours() + janelaHoras);
    if (new Date() > prazoLimite) {
      throw badRequest(
        `Cancelamento não permitido: prazo de ${janelaHoras}h após o início da viagem já expirou`,
      );
    }

    const resposta = await CiotProviderClient.cancelarOperacaoTransporte(
      {
        IdOperacaoTransporte: ciot.id_operacao_transporte,
        CodigoIdentificacaoOperacao: ciot.codigo_identificacao_operacao,
        Justificativa: justificativa,
      },
      certificado,
    );

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      throw badRequest(
        "Provedor de CIOT rejeitou o cancelamento da operação de transporte",
        { codigo: resposta?.Codigo, mensagem: resposta?.Mensagem },
      );
    }

    const updated = await prisma.fiscal_ciots.update({
      where: { id: ciot.id },
      data: {
        status: CIOT_STATUS.CANCELADO,
        cancelled_at: new Date(),
        response_data: resposta,
      },
    });
    // Cancelar o CIOT não cancela o contrato de frete.
    return serializeContrato(contrato, updated);
  }

  static async encerrar(tenantId, id) {
    const { contrato, ciot } = await resolverContratoParaCiot(tenantId, id);
    if (!ciot || !ciot.codigo_identificacao_operacao) {
      throw badRequest(
        "Este contrato ainda não possui CIOT registrado para encerrar.",
      );
    }
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      contrato.fiscal_empresa_id,
    );

    const resposta = await CiotProviderClient.encerrarOperacaoTransporte(
      {
        IdOperacaoTransporte: ciot.id_operacao_transporte,
        CodigoIdentificacaoOperacao: ciot.codigo_identificacao_operacao,
      },
      certificado,
    );

    if (resposta?.Codigo !== CODIGO_SUCESSO_OPERACAO) {
      throw badRequest(
        "Provedor de CIOT rejeitou o encerramento da operação de transporte",
        { codigo: resposta?.Codigo, mensagem: resposta?.Mensagem },
      );
    }

    const updated = await prisma.fiscal_ciots.update({
      where: { id: ciot.id },
      data: { status: CIOT_STATUS.ENCERRADO, response_data: resposta },
    });
    // Encerrar o CIOT na ANTT conclui a operação; não é o mesmo que cancelar o contrato.
    await prisma.fiscal_contratos_frete.update({
      where: { id: contrato.id },
      data: { status: CONTRATO_STATUS.CONCLUIDO },
    });
    const atualizado = await prisma.fiscal_contratos_frete.findFirst({
      where: { id: contrato.id, tenant_id: Number(tenantId) },
    });
    return serializeContrato(atualizado, updated);
  }

  static async consultarSituacaoTransportador(tenantId, body) {
    const dto = consultarSituacaoTransportadorSchema.parse(body);
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      dto.fiscal_empresa_id,
    );
    return CiotProviderClient.consultarSituacaoTransportador(
      { CpfCnpj: dto.cpf_cnpj, RNTRC: dto.rntrc },
      certificado,
    );
  }

  static async consultarCiotGerado(tenantId, id) {
    const { contrato, ciot } = await resolverContratoParaCiot(tenantId, id);
    if (!ciot) {
      throw badRequest(
        "Este contrato ainda não possui registro de CIOT para consultar.",
      );
    }
    const { certificado } = await resolveEmpresaCertificado(
      tenantId,
      contrato.fiscal_empresa_id,
    );
    return CiotProviderClient.consultarCiotGerado(
      { IdOperacaoTransporte: ciot.id_operacao_transporte },
      certificado,
    );
  }
}
