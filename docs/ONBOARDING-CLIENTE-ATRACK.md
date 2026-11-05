# Onboarding de cliente — ATrack

Objetivo: colocar a transportadora em operação com uma rotina simples, dados conferidos e responsáveis definidos.

## Fase 1 — Preparação comercial

- Proposta e contrato aceitos.
- Plano, quantidade de veículos e usuários confirmados.
- Implantação, migração e integrações claramente descritas.
- Responsável do cliente nomeado.
- Data-alvo de entrada em operação definida.

**Saída:** escopo assinado e cronograma combinado.

## Fase 2 — Coleta de dados

Solicitar apenas os dados necessários ao escopo:

- Empresa e contatos.
- Usuários e respectivos perfis.
- Frota, placas, tipos, marca, modelo, ano e quilometragem.
- Motoristas, CNH e validade.
- Documentos e vencimentos.
- Pneus e estoque, se incluídos.
- Histórico de gastos/manutenção, se contratado.
- Dados fiscais, certificado e credenciais, se aplicável.

Registrar inconsistências antes da importação. O cliente deve aprovar correções de dados.

**Saída:** arquivos recebidos e validados para importação.

## Fase 3 — Configuração

- Criar ou validar o tenant.
- Confirmar plano, limites e status da assinatura.
- Criar administrador e enviar convite pelos canais configurados.
- Configurar perfis e permissões.
- Importar ou cadastrar dados acordados.
- Conferir isolamento do tenant e acesso dos usuários.
- Testar alertas, relatórios e uploads.

**Saída:** ambiente básico pronto para homologação do cliente.

## Fase 4 — Fiscal, quando contratado

- Confirmar que o cliente possui responsável fiscal.
- Configurar empresa fiscal, CRT, IE, RNTRC e séries.
- Cadastrar UserToken, Token e certificado A1 pelos fluxos seguros.
- Usar ambiente separado de homologação.
- Testar CT-e: rascunho, emissão, consulta, XML, PDF e cancelamento.
- Testar MDF-e: rascunho, emissão, consulta, XML, PDF, encerramento e cancelamento.
- Testar averbação somente com credenciais homologadas.
- Não habilitar promessa de CIOT real sem provedor homologado.
- Configurar volume persistente e backup dos arquivos fiscais.

**Saída:** responsável fiscal aprova os testes e autoriza a mudança para produção.

## Fase 5 — Treinamento

Separar o treinamento por função:

- Administrador: usuários, permissões, assinatura, configurações e auditoria.
- Operador: cadastro, rotina de lançamentos, documentos, pneus e manutenção.
- Gestor: dashboard, alertas e relatórios.
- Fiscal: empresa fiscal, CT-e, MDF-e, rejeições e conferência.

Usar dados de teste e exercícios próximos da operação real.

**Saída:** pelo menos um responsável de cada função consegue concluir sua rotina principal.

## Fase 6 — Entrada em operação

- Confirmar backup e monitoramento.
- Confirmar canais de suporte.
- Definir data e horário da virada.
- Evitar migração e mudança fiscal crítica no mesmo momento, quando possível.
- Acompanhar os primeiros lançamentos.
- Registrar problemas e responsáveis.

**Saída:** cliente realizando a rotina diária no ATrack.

## Fase 7 — Acompanhamento de 30 dias

### Após 7 dias

- Usuários conseguiram acessar?
- Os dados estão sendo lançados?
- Alertas fazem sentido?
- Há bloqueios de treinamento?

### Após 15 dias

- Revisar qualidade dos cadastros.
- Conferir documentos e vencimentos.
- Conferir gastos, manutenção e relatórios.
- Ajustar permissões.

### Após 30 dias

- Comparar o resultado com o objetivo comercial inicial.
- Medir usuários ativos e rotinas adotadas.
- Registrar melhorias e demandas fora do escopo.
- Formalizar encerramento da implantação.

## Critérios para considerar a implantação concluída

- Administrador e usuários principais acessam o sistema.
- Frota do escopo está cadastrada e conferida.
- Perfis e permissões estão aprovados.
- Pelo menos uma rotina operacional foi executada pelo cliente.
- Relatório principal foi conferido.
- Integrações contratadas foram testadas.
- Treinamento contratado foi realizado.
- Pendências restantes estão registradas com responsável e prazo.

