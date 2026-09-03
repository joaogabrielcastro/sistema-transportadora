# Prompt pro Claude Code — Validação de campos: CT-e e MDF-e (correção)

## Contexto (sessão nova, sem memória)

Levantamento anterior mapeou o estado de validação de todos os campos de CT-e/MDF-e. Lista de problemas confirmados a corrigir nesta rodada — organizados por padrão de erro, não por campo isolado, porque a correção certa é **centralizar num componente reutilizável**, não remendar campo por campo:

1. CPF/CNPJ sem máscara/limite no front (participantes, novo cliente, CNPJ seguradora/instituição pagamento no MDF-e).
2. Texto sem limite nenhum, front e back (`cfop`, `natureza_operacao`, `rntrc` do modal, `condutor_nome` manual).
3. Monetários sem teto e sem "R$" (frete, componentes, infCarga, ICMS, Difal, TributosFederal, valor/peso do MDF-e).
4. Percentuais sem trava 0–100 (alíquota/redução ICMS, percentuais Difal).
5. Seguro do MDF-e inteiro sem schema real (é `looseObject`).
6. Campos que deveriam ser só número/sigla mas aceitam letra (CST, UF, CIOT — este último com teto errado, 20 em vez de 12).
7. Pontuais: e-mail sem `.email()`, telefone vai pontuado, CPF/CNPJ do tomador com teto inconsistente (18 vs 14), data de documento vinculado sem validação, lat/long sem faixa, vale-pedágio aceita negativo, UFs de percurso descartadas em silêncio.

## REGRA ACIMA DE TUDO

- **Não mexa em nada fora do módulo fiscal.** `FormField.jsx`/`numberInput.js` são compartilhados com o resto do sistema — só ADICIONE variantes novas (prop/tipo novo), nunca mude o comportamento das já existentes. Rode uma busca por outros usos de `FormField`/`numberInput` fora de `Cte`/`Mdfe` antes de mexer, pra confirmar que nada quebra.
- **Isso é validação de emissão NOVA, não retroativa.** Documentos já emitidos com dado "sujo" (CPF maior que 14 dígitos, etc.) não são afetados — a trava é só na hora de emitir dali pra frente, igual sempre fizemos com obrigatoriedade condicional.
- Migration só se algum limite novo no banco for necessário (nenhum campo muda de tipo — na dúvida, mantenha a coluna como está e valide só em código).
- Padrão de mercado pra máscara/formatação: React não usa `<input>` puro pra CPF/CNPJ/dinheiro em produção — normalize o valor (só dígitos) no estado, e mostre formatado só na tela (mask visual), nunca formatado no payload.
- Rode lint/typecheck/test depois de cada PARTE. Não commite nada sozinho.

## PARTE 1 — Componentes reutilizáveis novos (aditivo)

Crie (ou estenda `FormField.jsx` com prop `mask=`) os seguintes inputs, usados em toda tela fiscal daqui pra frente:

- **`CpfCnpjField`**: aceita só dígitos no `onChange` (`replace(/\D/g,"")`), exibe formatado (`000.000.000-00` ou `00.000.000/0000-00` conforme o tamanho), mas guarda no estado só os dígitos. `maxLength` dinâmico (11 ou 14, sem deixar passar de 14). Validação: exatamente 11 OU exatamente 14 dígitos — nunca "até 14".
- **`MoneyField`**: prefixo "R$" fixo no input, formata com separador de milhar, sempre 2 casas decimais, não aceita negativo (a menos que o campo especificamente precise, como lat/long — não é o caso dos monetários). Teto máximo = o que a coluna do banco aguenta sem estourar (confira a precisão `DECIMAL` de cada coluna no schema, ex: `DECIMAL(14,2)` → até 12 dígitos inteiros; não deixe passar disso). Valor no estado/payload é número puro, sem "R$" nem separador.
- **`PercentField`**: 0 a 100, 2 casas decimais, sem negativo.
- **`UfField`**: só letras, exatamente 2, uppercase automático.

Teste unitário pra cada um: dígito além do limite é cortado, formatação visual correta, valor interno sempre cru/numérico.

## PARTE 2 — Backend: apertar `fiscalSchema.js`

Troque `.string()`/`.number()` soltos por validação real, campo a campo:

| Campo | De | Para |
|---|---|---|
| `cfop` | `.string().trim().min(1)` | `.string().trim().length(4).regex(/^\d{4}$/)` |
| `natureza_operacao` | sem `.max()` | `.max(60)` |
| `rntrc` (modal rodoviário) | `looseObject`, sem validação | schema próprio: `.regex(/^\d{8,9}$/)` opcional |
| `cnpj_cpf` (participantes, tomador, novo cliente) | `.max(14)` solto, ou `.max(18)` no tomador | schema único compartilhado: `.regex(/^\d{11}$|^\d{14}$/)` — mesma regra em todo lugar, elimina a inconsistência do tomador |
| `email` (participantes) | `.max(120)` sem `.email()` | adicionar `.email()` |
| campos monetários (`valor_prestacao`, `icms_*`, `difal_v*`, `trib_*_valor`, `infCarga.valor_carga`/`peso`, MDF-e `valor`/`peso`, `antt_vale_pedagio_valor`) | `.nonnegative()` sem teto | `.nonnegative().max(<teto da precisão da coluna>)` |
| `icms_aliquota`, `icms_reducao_base`, `difal_p_*` | `.nonnegative()` sem teto | `.min(0).max(100)` |
| `icms_cst` | `.max(3)` sem regex | `.regex(/^\d{2,3}$/)` |
| `uf_carregamento`/`uf_descarregamento`, `ide.uf_ini`/`uf_fim`, `uf_ini`/`uf_fim` do CT-e | `.length(2)` sem regex | `.length(2).regex(/^[A-Z]{2}$/)` |
| `antt_ciot` | `.max(20)` sem regex | `.regex(/^\d{1,12}$/)` |
| `seguros[]` (MDF-e) | `z.array(z.record(...))` (looseObject) | schema tipado: `responsavel` enum 1/2, `cnpj_seguradora` regex 14 dígitos, `numero_apolice` `.max(40)`, `nome_seguradora` `.max(60)`, `numeros_averbacao` array de string com `.max(20)` cada |
| `documentos[].data_emissao` (infDoc) | `.optional()` sem validar formato | mesma validação de data usada em `dt_emissao` raiz |
| `prod_pred_lot_*_lat`/`_long` | sem range | lat: `.min(-90).max(90)`; long: `.min(-180).max(180)` |
| `percurso_ufs` | entradas inválidas descartadas em silêncio no front | back rejeita com erro claro se algum item não for 2 letras, em vez de aceitar lista incompleta |

Não mude nome de campo nem estrutura — só aperte a validação dentro do mesmo formato já usado.

## PARTE 3 — Frontend: aplicar os componentes novos nos campos da lista

Troque o `FormField` genérico pelos componentes da PARTE 1 exatamente nos campos listados no contexto (CPF/CNPJ, monetários, percentuais, UFs) em `CteForm.jsx`, `MdfeForm.jsx` e `ParticipanteFields`. Para os campos de texto sem limite (`cfop`, `natureza_operacao`, `rntrc`, `condutor_nome`), adicione `maxLength` compatível com o schema da PARTE 2. Corrija o telefone (`fone`) pra normalizar (só dígitos) no `onChange`, igual ao padrão já usado em CEP/código de município.

## PARTE 4 — Relatório final

Mesmo formato de sempre: componentes novos criados, tabela de-para de cada campo corrigido (schema antigo → novo), testes novos (componentes da PARTE 1 + schemas da PARTE 2), resultado de suíte completo, confirmação de que nenhum outro uso de `FormField`/`numberInput` fora do fiscal foi afetado. Não commite nada sozinho.
