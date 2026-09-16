# Averbação de seguro de transporte

Módulo desacoplado do CT-e/MDF-e. A emissão na SEFAZ **não espera** a
averbadora. Depois da autorização, um job em fila envia o XML protocolado.

Primeiro provedor implementado: **AT&M** (REST 2.0). Outras averbadoras entram
como nova classe em `backend/src/services/averbacao/providers/` e um `case` no
factory — **sem alterar** `CteService` / `MdfeService`.

## Arquitetura

```
CteService / MdfeService / fiscalConsulta
        │  (1 linha: agendarAverbacaoAposAutorizacao)
        ▼
AverbacaoService          ← orquestra tenant, idempotência, persistência
        │
        ▼
AverbacaoProvider         ← contrato
   └── AtmAverbacaoProvider
        │
        ▼
AT&M REST (Auth + POST XML)
```

Fila: BullMQ (`averbacao-seguro`), mesmo Redis da ordem de coleta. Sem Redis,
fallback em memória (dev/test).

## Contrato AT&M (oficial)

Manual: *Integração Web Service 2.0 REST v1.1* (atmtec.com.br).

| Ambiente    | Base URL (HTTPS no host oficial)              |
|-------------|-----------------------------------------------|
| Homologação | `https://homologaws.averba.com.br/rest`       |
| Produção    | `https://webserver.averba.com.br/rest`        |

O manual cita `http://`. Usamos **HTTPS no mesmo hostname e path**. As URLs
**não** são configuráveis pelo tenant (SSRF e mistura homolog/produção).

| Método | Path     | Body                                      |
|--------|----------|-------------------------------------------|
| POST   | `/Auth`  | JSON `{ usuario, senha, codigoatm }`      |
| POST   | `/Cte`   | XML do CT-e protocolado (ou cancelamento) |
| POST   | `/MDFe`  | XML do MDF-e protocolado                  |

Auth: token no JSON (`Bearer`), header `Authorization: Bearer …`.

CT-e autorizado na SEFAZ → averbação. MDF-e → **declaração** (`Declarado`),
não averbação de mercadoria. Cancelamento: XML de evento de cancelamento
protocolado na SEFAZ no **mesmo** path `/Cte` ou `/MDFe`.

**Não há endpoint REST de consulta.** Reenvio do XML é o comportamento
oficial de idempotência (“Documento já cadastrado” devolve protocolo).

Códigos reenviáveis automaticamente (manual §10 / §28): `000`, `907`, `910`,
timeout, 5xx. Recusas de consistência **não** são reenviadas sozinhas.

## Configuração por tenant

Tela: **Fiscal → Seguro / Averbação** (também link em Configurações).

Campos:

- Provedor (`atm`)
- Ambiente `homologacao` | `producao`
- Averbação automática (liga o job pós-CT-e)
- Seguradora, apólice, tipo de cobertura (informativos / snapshot)
- Código AT&M, usuário, senha (senha cifrada com `FISCAL_SECRETS_KEY`)

A API devolve `usuario_set` / `senha_set`, nunca o valor.

## Variáveis de ambiente

Não há credencial global da AT&M. Por tenant, no banco (cifrado).

```env
FISCAL_SECRETS_KEY=          # já usada no módulo fiscal
FISCAL_HTTP_TIMEOUT_MS=30000 # timeout HTTP da averbadora também
REDIS_URL=                   # fila durable; sem ela, memória
```

Worker: `npm run worker:averbacao` se a API estiver com
`RUN_ORDEM_WORKER_IN_API=false`.

## Fluxo

1. CT-e emitido e autorizado (status `processado` + XML em disco).
2. Se o tenant tem averbação **ativa e automática**, cria
   `fiscal_averbacoes` (`pending`) e enfileira o job.
3. Worker autentica na AT&M, envia o XML, grava protocolo / número / status.
4. A emissão do CT-e **já retornou** ao usuário nesse ponto.
5. Consulta SEFAZ que autoriza um CT-e atrasado dispara o mesmo agendamento.
6. Cancelamento do CT-e na SEFAZ agenda cancelamento da averbação **se** já
   estiver `averbed`. Sem XML de cancelamento protocolado o job fica em
   `error` reprocessável — a AT&M exige esse XML; não inventamos layout.

## Estados internos

`pending` → `processing` → `averbed` | `rejected` | `error` → (reprocessar)
`averbed` → `cancelled` (com XML de cancelamento)

Mapeamento AT&M: bloco `Averbado`/`Declarado` com `Protocolo` = `averbed`.
`Erros` de consistência = `rejected`. Timeout/000/907/910 = `error` retryable.

## Idempotência

Único por `(tenant_id, provider, tipo_documento, chave_acesso)`.

Antes de enviar: se já `averbed` ou `processing` recente, não reenvia.
“Documento já cadastrado” com protocolo é tratado como sucesso.

## Como testar em homologação

1. Peça login de homologação ao suporte AT&M (`sac@atmtec.com.br`, §27.9 / §30).
2. Ative `transporte_fiscal` no tenant.
3. Em Seguro / Averbação: ambiente **Homologação**, preencha código/usuário/senha.
4. Testar conexão.
5. Emita um CT-e em homologação SEFAZ (`BRASIL_NFE_AMBIENTE=2`). O XML com
   `tpAmb=2` gera protocolo AT&M `TESTE` (manual §12).
6. **Não** use credenciais de produção no ambiente de homologação.

Os testes automatizados **mockam** `fetch`. Não chamam a AT&M de verdade e
não contêm senha real.

## Como adicionar outra averbadora

1. Implementar `AverbacaoProvider` em `providers/NovaAverbadoraProvider.js`
   com o contrato oficial **dessa** API (não reutilizar paths da AT&M).
2. Registrar em `createAverbacaoProvider.js`.
3. Incluir o valor no `averbacaoProviderSchema` (Zod).
4. URLs hardcoded por ambiente, nunca vindas do tenant.
5. Testes com mock de HTTP + mapeamento de status.

## Homologação → produção

1. Troque o ambiente na tela para `producao`.
2. Grave as credenciais de produção do tenant (não as de teste).
3. Teste conexão.
4. A URL passa a ser só `webserver.averba.com.br`. Uma config `homologacao`
   **nunca** envia para produção (o provider recusa URL cruzada).

## Endpoints internos

Prefixo: `/api/fiscal/seguro` (feature `transporte_fiscal`).

| Método | Path | Quem |
|--------|------|------|
| GET    | `/config` | leitura fiscal |
| PUT    | `/config` | escrita fiscal |
| POST   | `/config/testar` | escrita fiscal |
| POST   | `/averbacoes` | `cte.write` |
| GET    | `/averbacoes/:id` | leitura fiscal |
| POST   | `/averbacoes/:id/consultar` | leitura fiscal |
| POST   | `/averbacoes/:id/reprocessar` | `cte.write` |
| POST   | `/averbacoes/:id/cancelar` | `cte.write` |

O detalhe do CT-e/MDF-e inclui `averbacao` (objeto público, sem segredos).

## O que a documentação da AT&M não define (não inventado)

- Formato JSON exato do `/Auth` além de “retorna o Token”. O campo `Bearer`
  vem de cliente público que já consome a API oficial.
- Endpoint REST de consulta de averbação (não existe no manual).
- Layout próprio de cancelamento se o XML SEFAZ de evento não estiver
  gravado no ATrack.
- Credenciais de homologação (só o suporte AT&M fornece).
