import prisma from "../../lib/prisma.js";
import { serializePrisma } from "../../utils/prismaSerialization.js";
import {
  fiscalEmpresaSchema,
  fiscalEmpresaUpdateSchema,
} from "../../schemas/fiscalSchema.js";
import { encryptSecret, secretIsSet } from "../../utils/fiscalCrypto.js";
import { findOwnedOr404 } from "./fiscalShared.js";

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
  const { cte_mdfe_provider_token, certificado_senha, resp_tec_csrt, ...rest } =
    row;
  return serializePrisma({
    ...rest,
    cte_mdfe_provider_token_set: secretIsSet(cte_mdfe_provider_token),
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
        certificado_pfx_path: data.certificado_pfx_path || null,
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
    if (data.certificado_pfx_path !== undefined)
      patch.certificado_pfx_path = data.certificado_pfx_path || null;
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
    await findOwnedOr404("fiscal_empresas", id, tenantId, "Empresa fiscal");
    await prisma.fiscal_empresas.delete({ where: { id: Number(id) } });
    return { deleted: true };
  }
}
