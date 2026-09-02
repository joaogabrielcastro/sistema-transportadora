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
  // emit.CRT do CT-e: 1 = Simples Nacional, 2 = SN excesso sublimite,
  // 3 = Regime Normal, 4 = MEI. Opcional no cadastro; a ausência é cobrada na
  // emissão de CT-e (CteService), com erro claro, nunca crash.
  crt: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .nullable(),
  inscricao_estadual: z.string().trim().max(20).optional().nullable(),
  // Grupo infRespTec (item 1.4). Todos opcionais no cadastro; a ausência NÃO
  // bloqueia emissão de CT-e (só gera aviso em log). resp_tec_csrt é cifrado
  // no service antes de gravar, igual ao token do provedor.
  resp_tec_cnpj: optionalDigits(14),
  resp_tec_contato: z.string().trim().max(60).optional().nullable(),
  resp_tec_email: z.string().trim().max(60).optional().nullable(),
  resp_tec_fone: z.string().trim().max(20).optional().nullable(),
  resp_tec_id_csrt: z.string().trim().max(10).optional().nullable(),
  resp_tec_csrt: z.string().trim().min(1).optional().nullable(),
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

// Participante do CT-e (rem / dest / exped / receb) — item 1.2. Todos os campos
// opcionais; `.catchall(z.any())` preserva chaves extras já enviadas hoje.
const participanteCteSchema = z
  .object({
    cnpj_cpf: optionalDigits(14),
    ie: z.string().trim().max(20).optional().nullable(),
    razao_social: z.string().trim().max(255).optional().nullable(),
    nome_fantasia: z.string().trim().max(255).optional().nullable(),
    fone: z.string().trim().max(20).optional().nullable(),
    email: z.string().trim().max(120).optional().nullable(),
    endereco: z
      .object({
        logradouro: z.string().trim().max(255).optional().nullable(),
        numero: z.string().trim().max(60).optional().nullable(),
        complemento: z.string().trim().max(255).optional().nullable(),
        bairro: z.string().trim().max(120).optional().nullable(),
        codigo_municipio: z.string().trim().max(7).optional().nullable(),
        nome_municipio: z.string().trim().max(120).optional().nullable(),
        uf: z.string().trim().max(2).optional().nullable(),
        cep: optionalDigits(8),
        codigo_pais: z.string().trim().max(4).optional().nullable(),
        nome_pais: z.string().trim().max(60).optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
  })
  .catchall(z.any())
  .optional()
  .nullable();

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
    // indAlteraToma do grupo infCteSub (1.5) — só faz sentido no Substituto (3).
    ind_alt_toma: z.boolean().optional().nullable(),
    cfop: z.string().trim().min(1),
    natureza_operacao: z.string().trim().min(1),
    dt_emissao: isoDateish,
    modal: looseObject.optional(),
    // Grupo carga do CT-e. `peso` (kg) e, quando informados, os campos do
    // infCarga (valor_carga / produto_predominante / outras_caracteristicas) e o
    // grupo infQ (`quantidades`) são persistidos e montados no payload; o resto
    // do grupo passa livre para o provedor.
    carga: z
      .object({
        peso: z.number().nonnegative().optional(),
        valor_carga: z.number().nonnegative().optional().nullable(),
        produto_predominante: z.string().trim().max(60).optional().nullable(),
        outras_caracteristicas: z.string().trim().max(30).optional().nullable(),
        quantidades: z
          .array(
            z
              .object({
                codigo_unidade: z.string().trim().max(2).optional().nullable(),
                tipo_medida: z.string().trim().max(20).optional().nullable(),
                quantidade: z.number().nonnegative().optional().nullable(),
              })
              .catchall(z.any()),
          )
          .optional(),
      })
      .catchall(z.any())
      .optional(),
    // Chave de acesso da NF-e transportada, vinculada ao CT-e (grupo
    // Carga.Documentos[].Chave do provedor). Opcional — conta como 1 documento
    // infDoc do tipo 'nfe' na exigência de >= 1 documento na emissão.
    chave_nfe_referenciada: optionalChaveAcesso,
    // Grupo infDoc do CT-e: documentos transportados. 'nfe' exige `chave`
    // (44 dígitos); 'nf' é modelo 01/1B por numero/serie. Não misturar 'nfe' e
    // 'nf' no mesmo CT-e (validado no superRefine). Persistido em
    // fiscal_cte_documentos após a emissão.
    documentos: z
      .array(
        z
          .object({
            tipo: z.enum(["nfe", "nf", "outros"]),
            chave: optionalChaveAcesso,
            numero: z.string().trim().max(20).optional().nullable(),
            serie: z.string().trim().max(10).optional().nullable(),
            data_emissao: z.string().trim().optional().nullable(),
            valor: z.number().nonnegative().optional().nullable(),
          })
          .catchall(z.any())
          .superRefine((doc, ctx) => {
            if (doc.tipo === "nfe" && !doc.chave) {
              ctx.addIssue({
                code: "custom",
                path: ["chave"],
                message:
                  "Documento infDoc do tipo 'nfe' exige a chave de acesso (44 dígitos).",
              });
            }
          }),
      )
      .optional(),
    imposto: looseObject.optional(),
    // Grupo imp.ICMS do CT-e 4.0 — campos lidos na validação de emissão. O
    // objeto `imposto` livre continua sendo repassado ao provedor sem alteração.
    icms: z
      .object({
        cst: z.string().trim().max(3).optional().nullable(),
        base: z.number().nonnegative().optional().nullable(),
        aliquota: z.number().nonnegative().optional().nullable(),
        valor: z.number().nonnegative().optional().nullable(),
        reducao_base: z.number().nonnegative().optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    // Grupo imp.IBSCBS do CT-e 4.0 (Reforma Tributária). Obrigatório na emissão
    // nova para emitente fora do Simples Nacional a partir de 05/01/2026
    // (cobrado no CteService, não aqui).
    ibscbs: z
      .object({
        cst: z.string().trim().max(3).optional().nullable(),
        c_class_trib: z.string().trim().max(6).optional().nullable(),
        base: z.number().nonnegative().optional().nullable(),
        ibs_uf_valor: z.number().nonnegative().optional().nullable(),
        ibs_mun_valor: z.number().nonnegative().optional().nullable(),
        cbs_valor: z.number().nonnegative().optional().nullable(),
        valor_total: z.number().nonnegative().optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    // Grupo vPrest do CT-e. `valor_prestacao` (vTPrest) segue como está; o array
    // `componentes` (grupo Comp — vPrest.Comp) é persistido em
    // fiscal_cte_componentes_frete e montado no payload. A soma NÃO é conferida
    // contra valor_prestacao — passthrough; inconsistência é rejeitada pelo
    // provedor.
    // Grupo seg do CT-e (item 1.6) — seguro da carga. TODO opcional (diferente
    // do MDF-e): sem assert de obrigatoriedade. `seguros` (array livre) tem
    // precedência sobre os campos planos, igual ao MDF-e.
    seg: z
      .object({
        responsavel: z.number().int().optional().nullable(),
        cnpj_seguradora: optionalDigits(14),
        numero_apolice: z.string().trim().max(40).optional().nullable(),
        numero_averbacao: z.string().trim().max(40).optional().nullable(),
        nome_seguradora: z.string().trim().max(60).optional().nullable(),
        seguros: z.array(looseObject).optional(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    servico: z
      .object({
        valor_prestacao: z.number().nonnegative().optional(),
        componentes: z
          .array(
            z
              .object({
                nome: z.string().trim().min(1).max(60),
                valor: z.number().nonnegative().optional().nullable(),
              })
              .catchall(z.any()),
          )
          .optional(),
      })
      .catchall(z.any()),
    tomador: z
      .object({ cpf_cnpj: digits(18) })
      .catchall(z.any()),
    // Grupos rem / dest / exped / receb do CT-e (1.2). Antes eram objeto livre;
    // agora tipam os campos que persistimos em fiscal_cte_participantes, mas o
    // `.catchall(z.any())` mantém qualquer chave extra que o chamador já mande —
    // payload atual continua válido.
    destinatario: participanteCteSchema,
    remetente: participanteCteSchema,
    expedidor: participanteCteSchema,
    recebedor: participanteCteSchema,
    // ide.toma: 0 = remetente, 1 = expedidor, 2 = recebedor, 3 = destinatário,
    // 4 = outros (dados no campo livre `tomador`).
    toma: z.number().int().min(0).max(4).optional().nullable(),
    // Grupo ICMSUFFim / DIFAL (item 1.3). uf_ini/uf_fim definem se a operação é
    // interestadual; tomador_ind_ie: 1 = contribuinte, 2 = isento, 9 = não
    // contribuinte. A obrigatoriedade condicional é cobrada no CteService.
    uf_ini: z.string().trim().max(2).optional().nullable(),
    uf_fim: z.string().trim().max(2).optional().nullable(),
    tomador_ind_ie: z
      .union([z.literal(1), z.literal(2), z.literal(9)])
      .optional()
      .nullable(),
    difal: z
      .object({
        vbc_uf_fim: z.number().nonnegative().optional().nullable(),
        p_fcp_uf_fim: z.number().nonnegative().optional().nullable(),
        p_icms_uf_fim: z.number().nonnegative().optional().nullable(),
        p_icms_inter: z.number().nonnegative().optional().nullable(),
        v_fcp_uf_fim: z.number().nonnegative().optional().nullable(),
        v_icms_uf_fim: z.number().nonnegative().optional().nullable(),
        v_icms_uf_ini: z.number().nonnegative().optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    // Grupo autXML (item 1.1): CNPJ/CPF de terceiros autorizados a baixar o XML.
    // Puramente opcional — array vazio ou ausente é válido; nenhuma exigência.
    // Aceita tanto strings ("12345678000199") quanto objetos ({ cnpj_cpf }).
    aut_xml: z
      .array(
        z.union([
          digits(14),
          z.object({ cnpj_cpf: optionalDigits(14) }).catchall(z.any()),
        ]),
      )
      .optional()
      .nullable(),
    // Contingência (item 1.2): dhCont / xJust / infSolicNFF. Tudo opcional —
    // contingência é exceção, não regra. infSolicNFF é objeto livre (estrutura
    // pendente do XSD oficial).
    contingencia: z
      .object({
        dh_contingencia: z.string().trim().optional().nullable(),
        justificativa: z.string().trim().max(256).optional().nullable(),
        inf_solic_nff: looseObject.optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    // Preparação split payment / pagamento antecipado (item 1.3, NT2026.001/002).
    // Objeto livre — passthrough puro, sem validação; ainda opcional em 2026.
    pagamento_antecipado: looseObject.optional().nullable(),
    // Grupo infTribFed (item 1.4): SÓ os totalizadores vPIS / vCOFINS do CT-e.
    // Sem CST/base/alíquota (isso é da NF-e). Opcional, sem validação.
    trib_fed: z
      .object({
        pis_valor: z.number().nonnegative().optional().nullable(),
        cofins_valor: z.number().nonnegative().optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
  })
  .superRefine((dto, ctx) => {
    // infDoc: os grupos infNFe (55) e infNF (01/1B) são exclusivos no CT-e.
    if (Array.isArray(dto.documentos) && dto.documentos.length > 0) {
      const tipos = new Set(dto.documentos.map((d) => d.tipo));
      if (tipos.has("nfe") && tipos.has("nf")) {
        ctx.addIssue({
          code: "custom",
          path: ["documentos"],
          message:
            "Não misture documentos 'nfe' e 'nf' no mesmo CT-e (grupos infNFe e infNF são exclusivos).",
        });
      }
    }
    if (dto.ind_alt_toma != null && dto.tipo_cte !== "3") {
      ctx.addIssue({
        code: "custom",
        path: ["ind_alt_toma"],
        message:
          "ind_alt_toma (indAlteraToma) só se aplica ao CT-e Substituto (tipo_cte = 3).",
      });
    }
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
  // 1 = prestador de serviço de transporte, 2 = transporte de carga própria
  // (frota própria), 3 = prestador CT-e globalizado. infANTT (2.2) e prodPred
  // (2.4) só são exigidos quando vier explicitamente 1 ou 3; ausente ou 2 não
  // exige (não quebra emissão de frota própria sem RNTRC que já funcionava).
  tipo_emitente: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional(),
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
  nome_seguradora: z.string().trim().max(60).optional().nullable(),
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
  // Grupo infANTT do MDF-e (2.2). Obrigatoriedade (quando não é frota própria)
  // cobrada no MdfeService, não aqui.
  inf_antt: z
    .object({
      rntrc: optionalDigits(9),
      ciot: z.string().trim().max(20).optional().nullable(),
      vale_pedagio: looseObject.optional().nullable(),
    })
    .catchall(z.any())
    .optional()
    .nullable(),
  // Grupo prodPred do MDF-e (2.4), forma tipada. `produto_predominante` livre
  // continua aceito.
  prod_pred: z
    .object({
      descricao: z.string().trim().max(120).optional().nullable(),
      ncm: z.string().trim().max(8).optional().nullable(),
      tp_carga: z.string().trim().max(2).optional().nullable(),
    })
    .catchall(z.any())
    .optional()
    .nullable(),
  // Grupo infMunCarrega do MDF-e (2.5): municípios de carregamento.
  municipios_carrega: z
    .array(
      z.object({
        codigo_municipio: z.string().trim().min(1).max(7),
        nome_municipio: z.string().trim().max(120).optional().nullable(),
      }),
    )
    .optional(),
  // Grupo infMunDescarga do MDF-e (item 2.1): documentos (CT-e/NF-e) agrupados
  // por município de descarregamento. Opcional — sem ele, o payload segue
  // usando a lista plana de chaves vinculadas (cte_ids), comportamento atual.
  municipios_descarga: z
    .array(
      z.object({
        codigo_municipio: z.string().trim().min(1).max(7),
        nome_municipio: z.string().trim().max(120).optional().nullable(),
        documentos: z
          .array(
            z.object({
              tipo: z.enum(["cte", "nfe", "mdfe"]),
              chave: optionalChaveAcesso,
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  // Campos básicos do grupo ide do MDF-e (2.5).
  ide: z
    .object({
      uf_ini: z.string().trim().length(2).optional().nullable(),
      uf_fim: z.string().trim().length(2).optional().nullable(),
      dh_ini_viagem: z.string().trim().optional().nullable(),
      tp_transp: z.number().int().optional().nullable(),
      modal: z.number().int().optional().nullable(),
    })
    .catchall(z.any())
    .optional()
    .nullable(),
});

// Encerramento do MDF-e (item 2.2). Todos os campos opcionais — corpo vazio ou
// ausente continua encerrando (comportamento atual). Quando informados, UF /
// município / data vão no evento e ficam gravados em fiscal_mdfes.encerrado_*.
export const encerrarMdfeSchema = z
  .object({
    uf: z.string().trim().length(2).optional().nullable(),
    codigo_municipio: z.string().trim().max(7).optional().nullable(),
    nome_municipio: z.string().trim().max(120).optional().nullable(),
    data_encerramento: isoDateish.optional().nullable(),
  })
  .partial()
  .optional();

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
    // FK -> fiscal_mdfes.id (opcional). CIOTs sem MDF-e continuam funcionando (3.2).
    mdfe_id: optionalId,
    tipo_operacao: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    // Categoria da operação (item 3.2). Opcional — quando ausente, o CiotService
    // deriva de tipo_operacao (1 = lotacao, 2 = fracionada, 3 = tac_agregado).
    categoria_operacao: z
      .enum(["lotacao", "fracionada", "tac_agregado"])
      .optional()
      .nullable(),
    cpf_cnpj_contratado: digits(14),
    rntrc_contratado: digits(9),
    // Snapshot da situação do RNTRC do contratado (item 3.1). Nesta rodada só
    // é gravado o que vier aqui — sem consulta automática à ANTT.
    rntrc_contratado_situacao: z.string().trim().max(20).optional().nullable(),
    rntrc_contratado_snapshot: looseObject.optional().nullable(),
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
        // NCM da carga (3.4) — opcional.
        ncm: z.string().trim().max(8).optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
    inf_pagamento: z.array(infPagamentoSchema).min(1),
    // Retenções do comprovante (item 3.3). Opcional. Alíquotas como fração
    // (0.022 = 2,2%). Sem alíquota aqui nem em FISCAL_CIOT_RETENCAO_*, nada é
    // calculado nem gravado — nenhum percentual é hardcoded.
    retencoes: z
      .object({
        base: z.number().nonnegative().optional().nullable(),
        inss_aliquota: z.number().nonnegative().optional().nullable(),
        inss_valor: z.number().nonnegative().optional().nullable(),
        sest_senat_aliquota: z.number().nonnegative().optional().nullable(),
        sest_senat_valor: z.number().nonnegative().optional().nullable(),
      })
      .catchall(z.any())
      .optional()
      .nullable(),
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
