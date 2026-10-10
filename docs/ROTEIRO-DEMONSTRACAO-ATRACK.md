# Roteiro de demonstração comercial — ATrack

Use este roteiro para apresentar o ATrack em 20 minutos, relacionando as telas aos problemas informados pelo prospect. A demonstração deve usar uma empresa exclusiva para testes, com dados fictícios e coerentes.

## 1. Objetivo da demonstração

Ao final da reunião, o prospect deve compreender:

- onde a equipe concentrará os dados da frota;
- como será a rotina de lançamentos e conferência;
- quais alertas e relatórios dependem desses registros;
- qual plano atende ao porte e ao escopo levantado;
- o que exige implantação, migração ou integração adicional;
- qual é o próximo passo, com responsável e data.

Não tente apresentar todos os menus. Escolha os fluxos relacionados às dores confirmadas na qualificação.

## 2. Conta demonstrativa

Mantenha uma empresa de demonstração separada de clientes reais.

### Usuários

- Um administrador para a demonstração principal.
- Um operador para mostrar a rotina diária, se necessário.
- Um usuário de consulta para explicar acesso somente leitura.

O administrador possui todas as permissões. O operador padrão pode trabalhar com frota, gastos, pneus, documentos, motoristas, relatórios e alertas. Permissões fiscais não são liberadas para o operador por padrão.

### Dados fictícios mínimos

- 5 veículos com tipos e situações diferentes.
- 5 motoristas, incluindo uma CNH próxima do vencimento.
- 8 documentos, com pelo menos um vencido e dois próximos do vencimento.
- Pneus atribuídos a pelo menos dois veículos.
- 10 gastos distribuídos entre combustível, pedágio, multa e outros tipos disponíveis.
- 3 manutenções, incluindo uma futura e uma concluída.
- Quilometragem suficiente para exibir relatórios de custo por quilômetro.
- Uma empresa fiscal de homologação, somente na conta destinada ao módulo fiscal.

Os valores devem parecer coerentes entre si. Não use documentos, certificados, placas, CPFs ou CNPJs pertencentes a pessoas e empresas reais.

## 3. Preparação antes da reunião

### Um dia antes

- Confirmar participantes, horário e duração.
- Revisar as dores anotadas no checklist comercial.
- Escolher no máximo três fluxos para aprofundar.
- Confirmar qual conta demonstrativa será usada.
- Verificar plano, features e permissões do usuário.
- Conferir se os dados fictícios ainda geram alertas e relatórios úteis.
- Preparar uma alternativa sem internet, como a apresentação comercial.

### Quinze minutos antes

- Abrir o sistema e autenticar.
- Fechar abas, notificações e aplicativos pessoais.
- Deixar o navegador com zoom em 100%.
- Abrir previamente o dashboard e um veículo de exemplo.
- Confirmar que nenhuma tela contém dados de outro cliente.
- Testar o fluxo que terá operação de escrita.

## 4. Roteiro principal de 20 minutos

### 0 a 2 minutos — confirmar o contexto

Diga:

> Antes de mostrar o sistema, quero confirmar se entendi corretamente. Hoje vocês controlam [PROCESSO ATUAL], e os principais problemas são [DOR 1] e [DOR 2]. A prioridade inicial é [RESULTADO]. Continua correto?

Se a prioridade mudou, adapte a demonstração antes de abrir vários módulos.

### 2 a 5 minutos — visão geral da operação

**Tela:** dashboard na rota `/` após autenticação.

Mostrar:

- situação geral da frota;
- alertas ou pendências que exijam atenção;
- custos e indicadores sustentados pelos dados cadastrados;
- acesso aos registros relacionados, quando disponível.

Explicar:

> O dashboard resume o que a equipe registra. Valor zerado significa que não houve lançamento naquele recorte. Ausência de dados significa que a base ainda não permite calcular o indicador.

Não apresentar como telemetria, rastreamento ou posição em tempo real.

### 5 a 9 minutos — veículo e histórico relacionado

**Telas:** lista de frota no dashboard e detalhe em `/caminhao/:placa`.

Mostrar:

- busca e identificação do veículo;
- placa, situação e informações cadastradas;
- motorista relacionado, quando houver;
- documentos, pneus, gastos e manutenção disponíveis no detalhe;
- histórico suficiente para explicar rastreabilidade.

Perguntar:

> Hoje, quanto tempo vocês levam para reunir essas informações quando alguém pergunta pelo histórico de um veículo?

Edição do veículo em `/caminhao/editar/:placa` exige `frota.write`. Não abra essa tela com usuário somente leitura.

### 9 a 12 minutos — rotina de lançamento

**Tela:** `/manutencao-gastos`.

Mostrar uma única operação de escrita com dados de teste:

1. Selecionar um veículo fictício.
2. Registrar um gasto ou uma manutenção simples.
3. Confirmar valor, data, quilometragem e categoria.
4. Salvar.
5. Mostrar o registro na listagem ou no histórico relacionado.

O usuário precisa de `gastos.write` para gravar. Não faça lançamentos na empresa real do prospect durante a demonstração.

### 12 a 14 minutos — documentos e alertas

**Telas:** `/documentos` e `/alertas`.

Mostrar:

- documento vencido;
- vencimento próximo;
- relação entre a data cadastrada e o alerta;
- responsável que deverá agir após o aviso.

Permissões necessárias:

- documentos: `docs.read`;
- alertas: `alerts.read`;
- alterações em documentos: `docs.write`.

Evite afirmar que um alerta externo por WhatsApp existe se esse canal não estiver contratado e configurado.

### 14 a 16 minutos — pneus ou motoristas

Escolha conforme a dor do prospect.

**Pneus:** `/pneus`, com estoque em `/pneus/estoque` e atribuição em `/pneus/atribuir`.

- Mostrar situação, veículo relacionado e histórico disponível.
- Alterações exigem `pneus.write`.

**Motoristas:** `/motoristas`.

- Mostrar cadastro, situação e vencimento da CNH.
- Consulta exige `motoristas.read`.
- Alterações exigem `motoristas.write`.

Não tente apresentar pneus e motoristas em profundidade na mesma demonstração, salvo se ambos forem prioridades explícitas.

### 16 a 18 minutos — relatórios

**Tela:** `/relatorios`.

Mostrar:

- seleção do período;
- relatório relacionado à dor levantada;
- custo por quilômetro somente quando houver quilometragem e gastos suficientes;
- como o gestor pode conferir lançamentos fora do padrão.

Acesso exige `reports.read`.

Explique que a qualidade do relatório depende da disciplina de lançamento da equipe. Não use números da empresa demonstrativa como promessa de economia para o prospect.

### 18 a 20 minutos — resumo e próximo passo

Recapitule somente o que foi demonstrado:

> Vimos como o ATrack pode organizar [ROTINA], reduzir a procura por [INFORMAÇÃO] e acompanhar [PENDÊNCIA OU CUSTO]. Para avançar, precisamos confirmar [PLANO], [IMPLANTAÇÃO OU MIGRAÇÃO] e [DEPENDÊNCIA].

Registre antes de encerrar:

- plano provável;
- quantidade confirmada de veículos e usuários;
- necessidade de implantação e migração;
- pendências técnicas;
- próxima ação;
- responsável;
- data.

## 5. Bloco fiscal opcional

Apresente o módulo fiscal somente quando a qualificação confirmar necessidade e a conta demonstrativa tiver a feature `transporte_fiscal`.

### Requisitos da conta

- Plano Fiscal ou Completo.
- Feature `transporte_fiscal` ativa.
- Usuário com permissões compatíveis.
- Empresa fiscal configurada para homologação.
- Dados e certificado próprios para teste, nunca pertencentes a outro cliente.

### Ordem recomendada

1. **Empresa fiscal:** `/fiscal/empresas`.
2. **Seguro e averbação:** `/fiscal/seguro`, quando aplicável.
3. **CT-e:** `/fiscal/cte`.
4. **MDF-e:** `/fiscal/mdfe`.
5. **Contrato de frete:** `/fiscal/contratos-frete`.

Permissões relevantes:

- CT-e: `cte.read` e `cte.write`;
- MDF-e: `mdfe.read` e `mdfe.write`;
- contrato de frete: `ciot.read` e `ciot.write`;
- configuração fiscal: alguma permissão de escrita fiscal compatível com a rota.

Explique com clareza:

- NF-e, estoque e transporte fiscal não existem no Starter.
- Fiscal e Completo possuem os mesmos módulos fiscais.
- O Completo aumenta limites de veículos e usuários.
- Brasil NFe, certificado e averbação possuem dependências externas.
- Emissão em produção depende de configuração e homologação.
- A rota legada `/fiscal/ciot` redireciona para contrato de frete.
- CIOT real não deve ser vendido como disponível até existir provedor contratado e homologado.

Não transmita documento fiscal real durante uma reunião comercial.

## 6. Funcionalidades que não entram na demonstração padrão

### Ordem de coleta

A rota `/ordem-coleta` depende da feature `ordem_coleta` e da permissão `ordem.send`. No código atual, essa feature é exclusiva do tenant ABroto e não faz parte dos planos públicos.

Não apresente ordem de coleta como funcionalidade contratável por um novo cliente.

### Administração

Mostre apenas quando houver pergunta sobre governança:

- usuários em `/usuarios`, com `users.manage`;
- empresa em `/empresa`, com `settings.write`;
- auditoria em `/auditoria`, com `audit.read`;
- assinatura em `/assinatura`.

Não gaste o tempo principal da demonstração em configuração administrativa.

## 7. Frases que evitam promessas indevidas

### Integração não verificada

> Vou registrar o fornecedor, a documentação e os dados necessários. Confirmamos viabilidade, prazo e valor depois da análise técnica.

### Consulta ao Detran

> O ATrack não deve ser apresentado hoje como consulta automática ao Detran. Precisamos validar estado, serviço disponível, certificado e regras de acesso antes de propor uma integração.

### Rastreamento

> O foco atual é gestão operacional e financeira da frota. Rastreamento em tempo real depende de integração homologada com o fornecedor utilizado pela empresa.

### Customização

> Esse fluxo não faz parte do produto padrão neste momento. Podemos documentar a necessidade e avaliar separadamente.

### Prazo de desenvolvimento

> Preciso avaliar o impacto técnico antes de informar prazo ou valor. A reunião de hoje serve para registrar o requisito com precisão.

## 8. Plano de contingência

### Internet indisponível

- Usar a apresentação comercial.
- Percorrer o processo por telas já capturadas, se houver material atualizado.
- Continuar o diagnóstico e combinar uma demonstração online.
- Não improvisar funcionalidades que o cliente não viu.

### Ambiente com erro

- Registrar a tela e o horário sem expor dados sensíveis.
- Não testar correções em produção durante a reunião.
- Passar para outro fluxo já validado.
- Enviar a evidência corrigida no acompanhamento, se isso fizer parte do próximo passo.

### Dado demonstrativo insuficiente

- Explicar que o indicador depende de lançamentos.
- Mostrar o fluxo de origem do dado.
- Não inventar números para preencher o dashboard ou relatório.

## 9. Registro após a demonstração

Atualize o pipeline no mesmo dia:

- etapa `Demonstração realizada`;
- pontuação de qualificação;
- plano provável;
- MRR estimado;
- pacote de implantação provável;
- integração ou dependência a avaliar;
- objeção principal;
- próxima ação, responsável e data.

Envie ao prospect um resumo curto com dores confirmadas, aderência demonstrada, pendências e próximo passo. Use o modelo de mensagem do playbook de vendas.

