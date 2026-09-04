import { secretIsSet } from "../../utils/fiscalCrypto.js";

/**
 * Modo demonstração: monta o mesmo payload da emissão real sem transmitir
 * à Brasil NFe / SEFAZ. Não gera chave, protocolo nem XML/DACTE oficiais.
 */

export function empresaTemCertificadoA1(empresa) {
  return Boolean(
    empresa &&
      secretIsSet(empresa.certificado_senha) &&
      empresa.certificado_pfx_path,
  );
}

function etapa(id, label, status, detalhe) {
  return { id, label, status, detalhe };
}

/**
 * @param {{ tipo: "cte"|"mdfe"|"ciot", temCertificado: boolean }} args
 */
export function montarEtapasSimulacao({ tipo, temCertificado }) {
  if (tipo === "ciot") {
    const assinar = temCertificado
      ? etapa(
          "assinar",
          "Assinar (mTLS)",
          "pronto",
          "Certificado A1 cadastrado. Na declaração real o provedor usa mTLS.",
        )
      : etapa(
          "assinar",
          "Assinar (mTLS)",
          "pendente",
          "Pendente de credenciais do cliente: cadastre o certificado digital A1 (.pfx).",
        );
    return [
      etapa("preencher", "Preencher", "ok", "Dados do contrato de frete recebidos."),
      etapa(
        "validar",
        "Validar",
        "ok",
        "Schema, piso ANTT e partes iguais à declaração real.",
      ),
      etapa(
        "xml",
        "Montar declaração",
        "simulado",
        "Payload do provedor montado. Nada foi enviado à ANTT.",
      ),
      assinar,
      etapa(
        "enviar",
        "Enviar",
        "simulado",
        "Não transmitido. Este modo não chama o provedor de CIOT nem a ANTT.",
      ),
      etapa(
        "retorno",
        "Número CIOT",
        "pendente",
        "O código CIOT só existe após a declaração real na ANTT.",
      ),
      etapa(
        "dacte",
        "Comprovante",
        "pendente",
        "O comprovante só fica disponível depois da declaração real.",
      ),
    ];
  }

  const dacte = tipo === "mdfe" ? "DAMDFE" : "DACTE";
  const xmlNota =
    "Payload oficial montado. O XML assinado só nasce na Brasil NFe na emissão real.";
  const assinar = temCertificado
    ? etapa(
        "assinar",
        "Assinar",
        "pronto",
        "Certificado A1 cadastrado. Na emissão real a Brasil NFe assina o XML.",
      )
    : etapa(
        "assinar",
        "Assinar",
        "pendente",
        "Pendente de credenciais do cliente: cadastre o certificado digital A1 (.pfx).",
      );

  return [
    etapa("preencher", "Preencher", "ok", "Dados do formulário recebidos."),
    etapa(
      "validar",
      "Validar",
      "ok",
      "Schema e regras de negócio iguais à emissão real.",
    ),
    etapa("xml", "Gerar XML", "simulado", xmlNota),
    assinar,
    etapa(
      "enviar",
      "Enviar",
      "simulado",
      "Não transmitido. Este modo não chama a Brasil NFe nem a SEFAZ.",
    ),
    etapa(
      "retorno",
      "Autorização SEFAZ",
      "pendente",
      "Pendente de credenciais do cliente. Sem A1 não há autorização nem chave de acesso.",
    ),
    etapa(
      "dacte",
      dacte,
      "pendente",
      `O ${dacte} (PDF) só fica disponível depois da autorização real.`,
    ),
  ];
}

export function resultadoSimulacaoDocumento({
  tipo,
  documento,
  payload,
  empresa,
}) {
  const temCertificado = empresaTemCertificadoA1(empresa);
  if (tipo === "ciot") {
    return {
      simulacao: true,
      transmitido: false,
      tipo,
      ambiente: null,
      documento,
      payload_ciot: payload,
      etapas: montarEtapasSimulacao({ tipo, temCertificado }),
      pendencias: {
        certificado_a1: !temCertificado,
        declaracao_antt: true,
        numero_ciot: true,
      },
      aviso:
        "Demonstração: o contrato não foi enviado à ANTT. Nada aqui vale como CIOT declarado.",
    };
  }

  const dacte = tipo === "mdfe" ? "DAMDFE" : "DACTE";
  return {
    simulacao: true,
    transmitido: false,
    tipo,
    ambiente: documento?.ambiente ?? null,
    documento,
    payload_brasil_nfe: payload,
    etapas: montarEtapasSimulacao({ tipo, temCertificado }),
    pendencias: {
      certificado_a1: !temCertificado,
      autorizacao_sefaz: true,
      xml_oficial: true,
      [dacte.toLowerCase()]: true,
    },
    aviso:
      "Demonstração: o documento não foi enviado à SEFAZ. Nada aqui vale como CT-e/MDF-e autorizado.",
  };
}
