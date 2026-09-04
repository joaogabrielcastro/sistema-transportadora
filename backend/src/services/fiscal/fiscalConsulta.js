import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import { config } from "../../config/index.js";
import { BrasilNFeClient } from "./brasilNfe/BrasilNFeClient.js";
import {
  findOwnedOr404,
  resolveEmpresaCteMdfe,
  salvarXmlBase64,
} from "./fiscalShared.js";
import {
  dadosPersistenciaConsulta,
  deveConsultarProvedor,
  escolherNotaConsultada,
  extrairBase64Arquivo,
  interpretarNotaConsultada,
  listarNotasConsulta,
  montarPayloadObterNotasFiscais,
} from "./fiscalStatus.js";

/**
 * Consulta o documento na Brasil NFe (ObterNotasFiscais) e reconcilia
 * status/chave/protocolo. Se autorizado e ainda sem XML, baixa via
 * ObterArquivoNotaFiscal.
 *
 * @param {"fiscal_ctes"|"fiscal_mdfes"} table
 * @param {"cte"|"mdfe"} tipoArquivo
 */
export async function consultarDocumentoFiscal({
  table,
  tipoArquivo,
  tenantId,
  id,
  label,
  identificadorInterno,
  getById,
}) {
  const row = await findOwnedOr404(table, id, tenantId, label);
  logger.info(`${label} consultado`, {
    tenantId,
    id: row.id,
    status: row.status,
  });

  if (!deveConsultarProvedor(row)) {
    const local = getById
      ? await getById(tenantId, id)
      : serializePrisma(row);
    return {
      ...local,
      consulta: {
        origem: "local",
        mensagem: `${label} ainda sem chave de acesso.`,
      },
    };
  }

  try {
    const { token } = await resolveEmpresaCteMdfe(
      tenantId,
      row.fiscal_empresa_id ?? undefined,
    );
    const ambiente = row.ambiente ?? config.fiscal.ambiente;
    const payload = montarPayloadObterNotasFiscais({
      identificadorInterno,
      ambiente,
      dataRef: row.data_emissao || row.emissao_iniciada_em || row.criado_em,
    });
    const resposta = await BrasilNFeClient.obterNotasFiscais(payload, token);
    const notas = listarNotasConsulta(resposta);
    const nota = escolherNotaConsultada(notas, {
      identificadorInterno,
      chave: row.chave_acesso,
    });
    const interpretacao = interpretarNotaConsultada(nota);
    const data = dadosPersistenciaConsulta(interpretacao, nota, {
      row,
      identificadorInterno,
    });
    if (data) {
      await prisma[table].update({
        where: { id: row.id },
        data,
      });
    }

    let xmlDisponivel = Boolean(row.xml_path);
    const aposUpdate = data
      ? { ...row, ...data }
      : row;
    if (aposUpdate.chave_acesso && !aposUpdate.xml_path) {
      try {
        const arquivo = await BrasilNFeClient.obterArquivoNotaFiscal(
          {
            ChaveNF: aposUpdate.chave_acesso,
            FileType: 1,
            TipoDocumentoFiscal: 1,
          },
          token,
        );
        const base64 = extrairBase64Arquivo(arquivo);
        if (base64) {
          const xmlPath = await salvarXmlBase64(
            tipoArquivo,
            tenantId,
            aposUpdate.chave_acesso,
            base64,
          );
          if (xmlPath) {
            await prisma[table].update({
              where: { id: row.id },
              data: { xml_path: xmlPath },
            });
            xmlDisponivel = true;
          }
        }
      } catch (err) {
        logger.error(`Falha ao gravar XML consultado do ${label}`, {
          tenantId,
          id: row.id,
          message: err.message,
        });
      }
    } else {
      xmlDisponivel = Boolean(aposUpdate.xml_path);
    }

    const atualizado = getById
      ? await getById(tenantId, id)
      : serializePrisma(
          await prisma[table].findFirst({
            where: { id: row.id, tenant_id: Number(tenantId) },
          }),
        );

    return {
      ...atualizado,
      consulta: {
        origem: "brasil_nfe",
        xml_disponivel: xmlDisponivel,
        mensagem: interpretacao.mensagem,
      },
    };
  } catch (err) {
    logger.warn(`Consulta ${label} na Brasil NFe falhou; devolvendo status local`, {
      tenantId,
      id: row.id,
      message: err.message,
    });
    const local = getById
      ? await getById(tenantId, id)
      : serializePrisma(row);
    return {
      ...local,
      consulta: {
        origem: "local",
        mensagem: err.message,
      },
    };
  }
}
