import { z } from "zod";
import { chaveAcessoValida } from "../utils/fiscalDocs.js";

/**
 * Schemas Zod do módulo fiscal de transporte (CT-e / MDF-e / CIOT).
 * Campos da nossa API em snake_case (convenção ATrack). Cada service traduz
 * para o formato do provedor externo (provedor de CT-e/MDF-e / provedor de CIOT).
 * O provedor definitivo ainda não foi decidido — nada aqui carrega nome de fornecedor.
 *
 * Os payloads de emissão têm dezenas de campos fiscais aninhados (endereços,
 * impostos, DIFAL, IBS/CBS, seguros, ...). Só validamos a fundo o que o
 * service realmente lê; o resto passa como objeto livre (`.catchall`) e é
 * repassado ao provedor — mantém o módulo mínimo sem travar emissão.
 */

const digits = (max) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(1).max(max));

const optionalDigits = (max) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().max(max))
    .optional()
    .nullable();

const optionalId = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === null) return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isNaN(n) ? null : n;
}, z.union([z.null(), z.number().int().positive()]).optional());

const isoDateish = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Data inválida (use ISO 8601)",
  });

const looseObject = z.record(z.string(), z.any());

// Chave de acesso (44 dígitos) de documento fiscal eletrônico, opcional.
// Normaliza para só dígitos e confere o dígito verificador (módulo 11).
const optionalChaveAcesso = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(44, "A chave de acesso deve ter 44 dígitos"))
  .refine(chaveAcessoValida, "Chave de acesso inválida (dígito verificador)")
  .optional()
  .nullable();

// ---------------------------------------------------------------------
// fiscal_empresas
// ---------------------------------------------------------------------
export const fiscalEmpresaSchema = z.object({
  cnpj: digits(18),
  razao_social: z.string().trim().min(2).max(255),
  rntrc: optionalDigits(9),
  cte_mdfe_provider_token: z.string().trim().min(1).optional().nullable(),
  certificado_pfx_path: z.string().trim().max(500).optional().nullable(),
  certificado_senha: z.string().min(1).optional().nullable(),
  certificado_valido_ate: z.string().trim().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const fiscalEmpresaUpdateSchema = fiscalEmpresaSchema.partial();

// ---------------------------------------------------------------------
// fiscal_clientes
// ---------------------------------------------------------------------
export const fiscalClienteSchema = z.object({
  razao_social: z.string().trim().min(2).max(255),
  // Normalizado (só dígitos) já aqui — bug conhecido no jwsoft, corrigido na origem.
  cnpj_cpf: digits(14),
});

export const fiscalClienteUpdateSchema = fiscalClienteSchema.partial();

// ---------------------------------------------------------------------
// fiscal_veiculo_dados
// ---------------------------------------------------------------------
// Campos do grupo veicReboque do MDF-e (SEFAZ). Guardados na extensão fiscal
// do caminhão (fiscal_veiculo_dados) e usados quando o caminhão é uma carreta
// acoplada a um cavalo mecânico. Todos opcionais no cadastro; a obrigatoriedade
// dos essenciais (tara_kg, cap_kg, tipo_carroceria) é cobrada no MdfeService
// na hora de emitir, com mensagem amigável antes de chamar o provedor.
const reboqueDadosFields = {
  renavam: z.string().trim().max(20).optional().nullable(),
  tara_kg: z.number().int().nonnegative().optional().nullable(),
  cap_kg: z.number().int().nonnegative().optional().nullable(),
  cap_m3: z.number().nonnegative().optional().nullable(),
  tipo_carroceria: z.string().trim().max(20).optional().nullable(),
  uf: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase())
    .optional()
    .nullable(),
};

export const fiscalVeiculoDadosSchema = z.object({
  caminhao_id: z.number().int().positive(),
  rntrc_veiculo: optionalDigits(9),
  ...reboqueDadosFields,
});

export const fiscalVeiculoDadosUpdateSchema = z.object({
  rntrc_veiculo: optionalDigits(9),
  ...reboqueDadosFields,
});

// ---------------------------------------------------------------------
// Cancelamento (CT-e / MDF-e / CIOT) — justificativa 15..1000
// ---------------------------------------------------------------------
export const cancelarDocumentoSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "A justificativa deve ter entre 15 e 1000 caracteres")
    .max(1000, "A justificativa deve ter entre 15 e 1000 caracteres"),
});

// ---------------------------------------------------------------------
// CT-e
// ---------------------------------------------------------------------
// Tipos de CT-e aceitos na v4.0. "2" (Anulação) foi EXTINTO pela Receita na
// v4.0 (a função de anulação virou o CT-e Substituto "3"), por isso não entra
// no enum. "1" = Complemento de Valores, "3" = Substituto.
export const TIPOS_CTE = ["0", "1", "3"];

export const emitirCteSchema = z
  .object({
    cliente_id: z.number().int().positive(),
    // CNPJ emissor (token do provedor de CT-e/MDF-e). Opcional: se o tenant só
    // tem 1 empresa fiscal ativa, ela é usada automaticamente.
    fiscal_empresa_id: optionalId,
    caminhao_id: optionalId,
    motorista_id: optionalId,
    tipo_cte: z.enum(TIPOS_CTE, {
      message:
        'tipo_cte deve ser "0" (Normal), "1" (Complemento de Valores) ou "3" (Substituto). O tipo "2" (Anulação) foi extinto no CT-e 4.0.',
    }),
    // Obrigatório para Complemento (1) e Substituto (3): aponta o CT-e original
    // já emitido (mesmo tenant). Validado no CteService.
    cte_referenciado_id: optionalId,
    cfop: z.string().trim().min(1),
    natureza_operacao: z.string().trim().min(1),
    dt_emissao: isoDateish,
    modal: looseObject.optional(),
    // `peso` (kg) do grupo carga; o resto do grupo passa livre para o provedor.
    carga: z
      .object({ peso: z.number().nonnegative().optional() })
      .catchall(z.any())
      .optional(),
    // Chave de acesso da NF-e transportada, vinculada ao CT-e (grupo
    // Carga.Documentos[].Chave do provedor). Opcional.
    chave_nfe_referenciada: optionalChaveAcesso,
    imposto: looseObject.optional(),
    servico: z
      .object({ valor_prestacao: z.number().nonnegative().optional() })
      .catchall(z.any()),
    tomador: z
      .object({ cpf_cnpj: digits(18) })
      .catchall(z.any()),
    destinatario: looseObject.optional(),
    remetente: looseObject.optional(),
    expedidor: looseObject.optional(),
  })
  .superRefine((dto, ctx) => {
    const precisaReferencia = dto.tipo_cte === "1" || dto.tipo_cte === "3";
    if (precisaReferencia && dto.cte_referenciado_id == null) {
      ctx.addIssue({
        code: "custom",
        path: ["cte_referenciado_id"],
        message:
          "cte_referenciado_id é obrigatório para CT-e de Complemento de Valores (1) ou Substituto (3).",
      });
    }
    // Complemento de Valores só carrega o valor adicional — precisa ser positivo.
    if (
      dto.tipo_cte === "1" &&
      !(Number(dto.servico?.valor_prestacao) > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["servico", "valor_prestacao"],
        message:
          "Para CT-e de Complemento de Valores, servico.valor_prestacao deve ser o valor adicional (positivo).",
      });
    }
  });

export const vincularManifestoSchema = z.object({
  manifesto_id: z.number().int().positive().nullable(),
});

// ---------------------------------------------------------------------
// MDF-e
// ---------------------------------------------------------------------
export const emitirMdfeSchema = z.object({
  fiscal_empresa_id: optionalId,
  caminhao_id: optionalId,
  motorista_id: optionalId,
  serie: z.string().trim().max(10).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  codigo: z.string().trim().optional().nullable(),
  tipo_emitente: z.union([z.literal(1), z.literal(2)]).optional(),
  data_emissao: isoDateish,
  // CT-e já emitidos (mesmo tenant, status "processado", ainda sem manifesto)
  // a vincular a este MDF-e. Validados no MdfeService, que grava manifesto_id
  // em cada um após a emissão.
  cte_ids: z.array(z.number().int().positive()).optional(),
  // Seguro da carga (grupo seg do MDF-e). resp_seg: 1 = emitente do MDF-e,
  // 2 = contratante do serviço de transporte. Os demais são opcionais.
  resp_seg: z.union([z.literal(1), z.literal(2)]).optional(),
  cnpj_seguradora: optionalDigits(14),
  numero_apolice: z.string().trim().max(40).optional().nullable(),
  numero_averbacao: z.string().trim().max(40).optional().nullable(),
  uf_carregamento: z.string().trim().length(2),
  uf_descarregamento: z.string().trim().length(2),
  modalidade: z.number().int().optional(),
  valor: z.number().nonnegative().optional(),
  peso: z.number().nonnegative().optional(),
  rodoviario: z
    .object({
      placa: z.string().trim().optional().nullable(),
      condutores: z
        .array(
          z
            .object({
              nome: z.string().trim().min(1),
              cpf: digits(11),
            })
            .catchall(z.any()),
        )
        .optional(),
      // Fallback manual: só usado quando o cavalo mecânico ainda não tem
      // reboque vinculado em vinculos_composicao. O caminho principal é o
      // vínculo cadastrado — o MdfeService resolve os reboques sozinho.
      // Teto de 3: a SEFAZ admite no máximo 3 reboques (ex.: rodotrem).
      reboques: z
        .array(
          z
            .object({
              placa: z.string().trim().min(1),
              renavam: z.string().trim().max(20).optional().nullable(),
              tara_kg: z.number().int().nonnegative(),
              cap_kg: z.number().int().nonnegative(),
              cap_m3: z.number().nonnegative().optional().nullable(),
              tipo_carroceria: z.string().trim().min(1).max(20),
              uf: z
                .string()
                .trim()
                .length(2)
                .transform((v) => v.toUpperCase())
                .optional()
                .nullable(),
            })
            .catchall(z.any()),
        )
        .max(3, "O MDF-e admite no máximo 3 reboques")
        .optional(),
    })
    .catchall(z.any()),
  seguros: z.array(looseObject).optional(),
  carregamentos: z.array(looseObject).optional(),
  descarregamentos: z.array(looseObject).optional(),
  percurso_ufs: z.array(z.string().trim().length(2)).optional(),
  produto_predominante: looseObject.optional(),
});

export const encerrarMdfeSchema = z.object({}).optional();

// ---------------------------------------------------------------------
// CIOT
// ---------------------------------------------------------------------
const veiculoDeclaracaoSchema = z
  .object({
    placa: z.string().trim().min(7).max(8),
    rntrc_veiculo: digits(9),
    numero_eixos: z.number().int().positive(),
  })
  .catchall(z.any());

const infPagamentoSchema = z
  .object({
    tipo_pagamento: z.number().int(),
    valor: z.number().positive(),
  })
  .catchall(z.any());

export const declararCiotSchema = z
  .object({
    fiscal_empresa_id: z.number().int().positive(),
    caminhao_id: optionalId,
    motorista_id: optionalId,
    tipo_operacao: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    cpf_cnpj_contratado: digits(14),
    rntrc_contratado: digits(9),
    cpf_cnpj_contratante: digits(14),
    rntrc_contratante: optionalDigits(9),
    cpf_cnpj_destinatario: optionalDigits(14),
    valor_frete: z.number().positive(),
    // Obrigatórios por lei na Declaração de Operação de Transporte (ANTT):
    // piso mínimo de frete (Lei 13.703/2018) e Vale-Pedágio obrigatório
    // (Lei 10.209/2001). Sempre informados; 0 quando não há pedágio no percurso.
    valor_piso_minimo_frete: z.number().nonnegative(),
    valor_vale_pedagio: z.number().nonnegative(),
    data_declaracao: isoDateish,
    data_inicio_viagem: isoDateish,
    data_fim_viagem: isoDateish,
    veiculos: z.array(veiculoDeclaracaoSchema).min(2).max(5),
    origem_destino: z
      .object({
        codigo_municipio_origem: z.string().trim().min(1),
        codigo_municipio_destino: z.string().trim().min(1),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    dados_carga: z
      .object({
        codigo_natureza_carga: z.string().trim().min(1),
        peso_carga: z.number().positive(),
        codigo_tipo_carga: z.number().int(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    inf_pagamento: z.array(infPagamentoSchema).min(1),
    inf_indicadores_operacionais: z
      .object({
        possui_rastreamento: z.boolean().optional(),
        possui_seguro_carga: z.boolean().optional(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
  })
  .superRefine((dto, ctx) => {
    if (dto.tipo_operacao === 1 || dto.tipo_operacao === 2) {
      if (!dto.cpf_cnpj_destinatario) {
        ctx.addIssue({
          code: "custom",
          path: ["cpf_cnpj_destinatario"],
          message:
            "cpf_cnpj_destinatario é obrigatório para operações do tipo Lotação ou Fracionada",
        });
      }
      if (!dto.origem_destino) {
        ctx.addIssue({
          code: "custom",
          path: ["origem_destino"],
          message:
            "origem_destino é obrigatório para operações do tipo Lotação ou Fracionada",
        });
      }
      if (!dto.dados_carga) {
        ctx.addIssue({
          code: "custom",
          path: ["dados_carga"],
          message:
            "dados_carga é obrigatório para operações do tipo Lotação ou Fracionada",
        });
      }
    }
    if (dto.tipo_operacao === 3 && dto.cpf_cnpj_destinatario) {
      ctx.addIssue({
        code: "custom",
        path: ["cpf_cnpj_destinatario"],
        message:
          "cpf_cnpj_destinatario não deve ser informado para operações do tipo TAC-Agregado",
      });
    }
    if (dto.tipo_operacao === 1 && !dto.inf_indicadores_operacionais) {
      ctx.addIssue({
        code: "custom",
        path: ["inf_indicadores_operacionais"],
        message:
          "inf_indicadores_operacionais é obrigatório para operações do tipo Lotação",
      });
    }
  });

export const consultarSituacaoTransportadorSchema = z.object({
  fiscal_empresa_id: z.number().int().positive(),
  cpf_cnpj: digits(14),
  rntrc: digits(9),
});
