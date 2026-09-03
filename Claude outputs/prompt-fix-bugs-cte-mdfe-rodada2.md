# Prompt pro Claude Code — Correção de bugs de validação (CT-e / MDF-e) — rodada 2

## Contexto

Na rodada anterior foram criados os componentes `CpfCnpjField` / `MoneyField` / `PercentField` / `UfField` (`frontend/src/components/fiscal/FiscalFields.jsx` + `frontend/src/utils/fiscalFieldMask.js`) e o `fiscalSchema.js` foi apertado. Em uso real apareceram os bugs abaixo. Note que a maioria é em campo numérico/monetário — isso é forte indício de UM bug sistêmico na base compartilhada desses componentes, não de vários bugs isolados. Investigue a causa raiz antes de sair corrigindo campo por campo.

## REGRA ACIMA DE TUDO

- Só corrija os pontos listados abaixo. Não mexa em mais nada.
- Continue só ADICIONANDO em `FormField.jsx` / `numberInput.js` se for estritamente necessário — nunca mude o comportamento dos tipos já existentes que outras telas do sistema usam.
- Ao terminar, rode a suíte completa (backend e frontend) e cole o resultado no relatório.
- Se encontrar OUTROS campos com o mesmo padrão de bug que não estão nesta lista, **não corrija silenciosamente** — liste-os à parte no relatório final para a gente validar antes de aplicar.
- Não commite nada sozinho.

## Pista de investigação prioritária (provável causa raiz de vários itens abaixo)

Em `MoneyField` / `PercentField` (`FiscalFields.jsx`), o `onChange` aplica `clampMoneyRaw` / `clampPercentRaw` (`fiscalFieldMask.js` → `clampNumericRaw`) **a cada tecla digitada**, não só quando o campo perde o foco. `clampNumericRaw` converte o texto digitado até aquele momento em número e, se ultrapassar `max`, devolve `String(max)` imediatamente — no meio da digitação.

Isso bate exatamente com o relato de "Redução da base (%): digito 3 dígitos aleatórios e ele vira 100" — ao digitar o 3º dígito, o valor parcial já ultrapassa 100 e é substituído por "100" antes do usuário terminar de digitar. É bem provável que o mesmo mecanismo explique os relatos de "só um número antes da vírgula" / "trava em 1,00" / "não passa de um dígito" em Valor da prestação, infCarga (valor/quantidade/base do ICMS), TributosFederal e MDF-e (peso/valor) — mas confirme também, campo a campo, se o `ceiling`/`max` realmente passado no ponto de uso está correto (pode haver mais de uma causa somada).

**Correção esperada:** o clamp de mínimo/máximo só deve acontecer no blur (saída do campo) — exatamente como o `FormField` original (tipo `"number"`, que já existe e não deve ser alterado) já faz hoje. Durante a digitação, só normalizar caracteres e limitar casas decimais; nunca "corrigir" o valor para dentro do intervalo com base num número ainda parcial. Aplique essa correção UMA VEZ no lugar certo (não campo por campo) para resolver a família toda de uma vez, e só depois confirme campo a campo que o sintoma sumiu.

## CT-e

1. **RNTRC (modal rodoviário)** — hoje aceita 8 ou 9 dígitos (`/^\d{8,9}$/`). Trocar para **exatamente 8 dígitos**, no front (`maxLength`) e no back (`regex`).
2. **Valor da prestação (`servico.valor_prestacao`)** — trava em 1,00, não deixa digitar mais. Tem que aceitar até pelo menos **R$ 100.000.000,00**. Além da causa raiz acima, confirme o valor de `ceiling` realmente passado nesse `MoneyField` específico (compare com o padrão `MONEY_CEILING_14_2`).
3. **Tomador do serviço → Inscrição estadual** — aceita letra hoje; travar para **só números**.
4. **Tomador do serviço → Razão social** e **Nome fantasia** — aceitam dígito hoje; travar para **só letras** (pode manter espaço, acento e pontuação comum de nome/razão social, mas bloquear números).
5. **Tomador do serviço → Telefone** — sem limite hoje; travar em **DDD + 9 dígitos = 11 dígitos** no total.
6. **Tomador do serviço → E-mail** — validar formato de e-mail de verdade. Confirme se o `.email()` do schema realmente cobre esse campo específico do Tomador e se o front acusa erro de formato (não só depois do submit ao back).
7. **Tomador do serviço → Logradouro** — máx. **60** caracteres (hoje 255).
8. **Tomador do serviço → Número** — máx. **10** caracteres.
9. **Tomador do serviço → Complemento** — máx. **60** caracteres (hoje 255).
10. **Tomador do serviço → Bairro** — máx. **60** caracteres (hoje 120).
11. **Tomador do serviço → Município** — máx. **60** caracteres (hoje 120).
12. **infCarga → Quantidade (grupo infQ)** — mesmo bug de "só um número antes da vírgula"; além de corrigir o bug, aumentar um pouco o teto atual do valor de quantidade (o valor de hoje parece baixo demais para uso real — avalie um teto razoável e documente qual foi escolhido).
13. **infCarga → Base de cálculo do ICMS** — mesmo bug do clamp.
14. **ICMS → Redução da base (%)** e **Alíquota (%)** — mesmo bug do clamp (vira 100 sozinho).
15. **ICMS → Valor** — mesmo bug do clamp (não passa de 1 dígito).
16. **TributosFederal (todos os campos de valor)** — mesmo bug do clamp.

## MDF-e

17. **Peso** e **Valor da carga** — mesmo bug do clamp (ex.: tentar digitar "2,222" não funciona).
18. **Percurso — UFs** — está aceitando dígito. Confirme se esse campo realmente está usando o `UfField` (pode ser um input separado, tipo lista/tag de adicionar UF, que passou batido na rodada anterior) e aplique a mesma trava (só letra, 2 caracteres, maiúsculo automático).
19. **Municípios de carregamento (infMunCarrega) → Nome do município** — aceita dígito; travar para **só letras**.
20. **Nome do condutor** — aceita dígito; travar para **só letras**.
21. **CNPJ da seguradora (opcional)** — está com máscara de CPF (alterna formato conforme o tamanho digitado). Esse campo é **sempre CNPJ** (14 dígitos) — usar uma variante que trave em CNPJ fixo (equivalente ao `soCpf` do `CpfCnpjField`, só que para o lado do CNPJ), nunca a máscara que alterna entre CPF e CNPJ.
22. **GTIN (cEAN)** — reportado como "está aceitando dígito". GTIN é numérico por natureza (até 14 dígitos) ou o literal "SEM GTIN" (já existe comentário sobre isso no schema) — **não trave às cegas**: confirme com a gente o que exatamente está errado antes de mexer (pode ser um mal-entendido no teste, ou pode ser que o campo esteja aceitando letra solta além do dígito, ou passando de 14 caracteres). Descreva no relatório final o comportamento atual encontrado, e só corrija se identificar um problema real e coerente com o que o campo deveria ser.

## Verificação final obrigatória

- Depois de aplicar as correções, digite manualmente (ou escreva um teste automatizado) um valor de vários dígitos em cada `MoneyField` / `PercentField` tocado nesta lista para confirmar que não trava mais no meio da digitação.
- Rode lint / typecheck / test de novo (backend e frontend) e cole o resultado no relatório.
- Não commite nada sozinho.

## Relatório final

Mesmo formato de sempre — tabela de-para por item corrigido, mais uma seção separada **"Bugs parecidos encontrados e NÃO corrigidos"** listando qualquer outro campo com o mesmo padrão que não estava nesta lista, para a gente validar antes de aplicar.
