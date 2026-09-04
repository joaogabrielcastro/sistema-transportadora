import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import {
  fiscalEmpresaSchema,
  fiscalEmpresaUpdateSchema,
} from "../../schemas/fiscalSchema.js";
import {
  decryptSecret,
  encryptSecret,
  secretIsSet,
} from "../../utils/fiscalCrypto.js";
import { findOwnedOr404 } from "./fiscalShared.js";
import { BrasilNFeClient } from "./brasilNfe/BrasilNFeClient.js";
import { logger } from "../../utils/logger.js";
import { resolverCaminhoAbsoluto } from "./FiscalDownloadService.js";
import { UPLOADS_ROOT } from "../../utils/uploadPaths.js";
import fs from "node:fs/promises";
import path from "node:path";

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Remove os segredos crus da resposta da API. Nunca devolvemos token/senha,
 * só um booleano indicando que estão cadastrados.
 */
export function toPublicEmpresa(row) {
  if (!row) return row;
  const {
    cte_mdfe_provider_token,
    brasil_nfe_user_token,
    certificado_senha,
    resp_tec_csrt,
    ...rest
  } = row;
  return serializePrisma({
    ...rest,
    cte_mdfe_provider_token_set: secretIsSet(cte_mdfe_provider_token),
    brasil_nfe_user_token_set: secretIsSet(brasil_nfe_user_token),
    certificado_senha_set: secretIsSet(certificado_senha),
    resp_tec_csrt_set: secretIsSet(resp_tec_csrt),
  });
}

export class FiscalEmpresaService {
  static async list(tenantId) {
    const rows = await prisma.fiscal_empresas.findMany({
      where: { tenant_id: Number(tenantId) },
      orderBy: [{ ativo: "desc" }, { razao_social: "asc" }],
    });
    return rows.map(toPublicEmpresa);
  }

  static async getById(tenantId, id) {
    const row = await findOwnedOr404(
      "fiscal_empresas",
      id,
      tenantId,
      "Empresa fiscal",
    );
    return toPublicEmpresa(row);
  }

  static async create(tenantId, body) {
    const data = fiscalEmpresaSchema.parse(body);
    const row = await prisma.fiscal_empresas.create({
      data: {
        tenant_id: Number(tenantId),
        cnpj: data.cnpj,
        razao_social: data.razao_social,
        rntrc: data.rntrc || null,
        cte_mdfe_provider_token: data.cte_mdfe_provider_token
          ? encryptSecret(data.cte_mdfe_provider_token)
          : null,
        brasil_nfe_user_token: data.brasil_nfe_user_token
          ? encryptSecret(data.brasil_nfe_user_token)
          : null,
        certificado_senha: data.certificado_senha
          ? encryptSecret(data.certificado_senha)
          : null,
        certificado_valido_ate: parseDate(data.certificado_valido_ate),
        crt: data.crt ?? null,
        inscricao_estadual: data.inscricao_estadual || null,
        resp_tec_cnpj: data.resp_tec_cnpj || null,
        resp_tec_contato: data.resp_tec_contato || null,
        resp_tec_email: data.resp_tec_email || null,
        resp_tec_fone: data.resp_tec_fone || null,
        resp_tec_id_csrt: data.resp_tec_id_csrt || null,
        resp_tec_csrt: data.resp_tec_csrt
          ? encryptSecret(data.resp_tec_csrt)
          : null,
        ativo: data.ativo !== false,
      },
    });
    return toPublicEmpresa(row);
  }

  static async update(tenantId, id, body) {
    await findOwnedOr404("fiscal_empresas", id, tenantId, "Empresa fiscal");
    const data = fiscalEmpresaUpdateSchema.parse(body);

    const patch = {};
    if (data.cnpj !== undefined) patch.cnpj = data.cnpj;
    if (data.razao_social !== undefined) patch.razao_social = data.razao_social;
    if (data.rntrc !== undefined) patch.rntrc = data.rntrc || null;
    if (data.certificado_valido_ate !== undefined)
      patch.certificado_valido_ate = parseDate(data.certificado_valido_ate);
    if (data.crt !== undefined) patch.crt = data.crt ?? null;
    if (data.inscricao_estadual !== undefined)
      patch.inscricao_estadual = data.inscricao_estadual || null;
    if (data.resp_tec_cnpj !== undefined)
      patch.resp_tec_cnpj = data.resp_tec_cnpj || null;
    if (data.resp_tec_contato !== undefined)
      patch.resp_tec_contato = data.resp_tec_contato || null;
    if (data.resp_tec_email !== undefined)
      patch.resp_tec_email = data.resp_tec_email || null;
    if (data.resp_tec_fone !== undefined)
      patch.resp_tec_fone = data.resp_tec_fone || null;
    if (data.resp_tec_id_csrt !== undefined)
      patch.resp_tec_id_csrt = data.resp_tec_id_csrt || null;
    if (data.ativo !== undefined) patch.ativo = data.ativo;
    // Segredos: só regrava (cifrando) se veio valor não-vazio; null/"" limpa.
    if (data.cte_mdfe_provider_token !== undefined) {
      patch.cte_mdfe_provider_token = data.cte_mdfe_provider_token
        ? encryptSecret(data.cte_mdfe_provider_token)
        : null;
    }
    if (data.brasil_nfe_user_token !== undefined) {
      patch.brasil_nfe_user_token = data.brasil_nfe_user_token
        ? encryptSecret(data.brasil_nfe_user_token)
        : null;
    }
    if (data.certificado_senha !== undefined) {
      patch.certificado_senha = data.certificado_senha
        ? encryptSecret(data.certificado_senha)
        : null;
    }
    if (data.resp_tec_csrt !== undefined) {
      patch.resp_tec_csrt = data.resp_tec_csrt
        ? encryptSecret(data.resp_tec_csrt)
        : null;
    }

    const row = await prisma.fiscal_empresas.update({
      where: { id: Number(id) },
      data: patch,
    });
    return toPublicEmpresa(row);
  }

  static async remove(tenantId, id) {
    const empresa = await findOwnedOr404(
      "fiscal_empresas",
      id,
      tenantId,
      "Empresa fiscal",
    );
    const ciotVinculados = await prisma.fiscal_ciots.count({
      where: {
        tenant_id: Number(tenantId),
        fiscal_empresa_id: empresa.id,
      },
    });
    if (ciotVinculados > 0) {
      throw conflict(
        "Não é possível excluir: há contratos de frete (CIOT) vinculados a esta empresa.",
      );
    }

    await prisma.fiscal_empresas.delete({ where: { id: empresa.id } });

    if (empresa.certificado_pfx_path) {
      try {
        const abs = resolverCaminhoAbsoluto(empresa.certificado_pfx_path);
        await fs.unlink(abs);
      } catch {
        /* arquivo ausente não impede a exclusão */
      }
    }
    return { deleted: true };
  }

  /**
   * Envia o A1 (.pfx/.p12) à Brasil NFe (AlterarCertificado) e grava o arquivo
   * localmente (CIOT mTLS). Senha só em AES-256-GCM. Nunca devolve senha/arquivo.
   */
  static async enviarCertificado(tenantId, id, { buffer, senha }) {
    const empresa = await findOwnedOr404(
      "fiscal_empresas",
      id,
      tenantId,
      "Empresa fiscal",
    );
    if (!buffer?.length) {
      throw badRequest("Envie o arquivo do certificado A1 (.pfx ou .p12).");
    }
    if (!senha) {
      throw badRequest("Informe a senha do certificado.");
    }
    const token = decryptSecret(empresa.cte_mdfe_provider_token);
    if (!token) {
      throw badRequest(
        "Cadastre o Token da empresa na Brasil NFe antes de enviar o certificado.",
      );
    }
    const userToken = decryptSecret(empresa.brasil_nfe_user_token) || undefined;
    const resposta = await BrasilNFeClient.alterarCertificado(
      {
        Senha: senha,
        Base64CertificateFile: Buffer.from(buffer).toString("base64"),
      },
      { token, userToken },
    );
    if (resposta?.status === 2) {
      throw badRequest(
        resposta.Error ||
          "A Brasil NFe não conseguiu alterar o certificado. Confira o arquivo e a senha.",
      );
    }

    const relDir = path.join("fiscal", "certificados", String(tenantId));
    const absDir = path.join(UPLOADS_ROOT, relDir);
    await fs.mkdir(absDir, { recursive: true });
    const relPath = path.join(relDir, `${Number(id)}.pfx`).split(path.sep).join("/");
    await fs.writeFile(path.join(UPLOADS_ROOT, relPath), buffer);

    const validoAte = resposta?.DtExpiracao
      ? parseDate(resposta.DtExpiracao)
      : empresa.certificado_valido_ate;
    const row = await prisma.fiscal_empresas.update({
      where: { id: empresa.id },
      data: {
        certificado_pfx_path: relPath,
        certificado_senha: encryptSecret(senha),
        certificado_valido_ate: validoAte,
      },
    });
    logger.info("Certificado A1 vinculado à Brasil NFe", {
      tenantId,
      empresaId: empresa.id,
      expirado: resposta?.Expirado ?? null,
    });
    return toPublicEmpresa(row);
  }

  static async verificarCertificado(tenantId, id) {
    const empresa = await findOwnedOr404(
      "fiscal_empresas",
      id,
      tenantId,
      "Empresa fiscal",
    );
    const token = decryptSecret(empresa.cte_mdfe_provider_token);
    if (!token) {
      throw badRequest(
        "Cadastre o Token da empresa na Brasil NFe antes de verificar o certificado.",
      );
    }
    const userToken = decryptSecret(empresa.brasil_nfe_user_token) || undefined;
    const payload = {};
    if (empresa.certificado_pfx_path && empresa.certificado_senha) {
      try {
        const abs = resolverCaminhoAbsoluto(empresa.certificado_pfx_path);
        const buf = await fs.readFile(abs);
        payload.Base64CertificateFile = buf.toString("base64");
        payload.Senha = decryptSecret(empresa.certificado_senha);
      } catch {
        /* consulta o certificado já cadastrado na Brasil NFe */
      }
    }
    const resposta = await BrasilNFeClient.verificarCertificado(payload, {
      token,
      userToken,
    });
    logger.info("Certificado fiscal verificado na Brasil NFe", {
      tenantId,
      empresaId: empresa.id,
      expirado: resposta?.Expirado ?? null,
    });
    return {
      expirado: resposta?.Expirado ?? null,
      dt_expiracao: resposta?.DtExpiracao ?? null,
      status: resposta?.status ?? null,
      avisos: resposta?.Avisos ?? [],
      error: resposta?.Error ?? null,
    };
  }
}
