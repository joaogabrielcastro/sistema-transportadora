# ATrack Starter — Production Readiness (2026-10-26)

Relatório consolidado das pendências operacionais. **Não** é uma auditoria geral do produto.
Segredos, dumps e dados pessoais **não** estão incluídos.

## Classificação

**Bloqueado para receber clientes pagantes em produção.**

Justificativa técnica:

1. Frontend público **indisponível** (HTTP 503 `no available server`).
2. Backup automático do Postgres **desligado** (`backup.enabled=false`).
3. Preços Stripe **não configurados** (`priceConfigured=false` em todos os planos) — checkout impossível.
4. Sentry **não configurado**.
5. Entrega SMTP e backup de uploads **não comprovados**.

**Apto para demonstração de API / smoke técnico** apenas se o apresentador usar ambiente local ou restaurar o frontend. **Não** apto para trial comercial público enquanto o site estiver 503.

---

## Situação por etapa

### Etapa 1 — Coolify (`docs/COOLIFY-STARTER-VERIFY.md`)

| Área | Status | Onde validado |
| --- | --- | --- |
| Redis + worker + filas | APROVADO | Produção `/health` |
| Mail configurado | APROVADO (config) | Produção `/health` |
| Auth endpoints API | APROVADO parcial | Produção (401/400) |
| Frontend | REPROVADO | Produção 503 |
| Backup API | REPROVADO | Produção `/health` |
| Sentry | REPROVADO | Produção `/health` |
| Stripe prices | REPROVADO | Produção `/api/billing/plans` |
| Env no painel Coolify | PENDENTE | Sem acesso ao painel |

Evidência `/health` (produção, 2026-10-26T18:10:38Z), campos relevantes:

- `status=healthy`, `database.ok=true`
- `redis.configured=true`, `redis.ok=true`, `queueMode=redis`
- `worker.ok=true`
- `mail.configured=true`
- `backup.enabled=false`, `backup.last=null`
- `sentry.configured=false`
- `uploads.writable=true`

### Etapa 2 — Backup e recuperação

#### Banco

| Item | Resultado |
| --- | --- |
| Estratégia em produção | Código suporta `BACKUP_ENABLED` + `pg_dump` gzip + retenção + opcional S3; **desligado** no ambiente real |
| Restore isolado | **APROVADO localmente** (Docker `transportadora_postgres_dev`) |
| Dump | `backend/backups/atrack-2026-10-26T18-13-40.sql.gz` (≈58 KB, magic `1F 8B`) — **não versionar** (gitignore) |
| Restore target | Banco `atrack_restore` (criado e depois dropado) |
| Integridade | `tenants=8`, `users=12`, coluna `users.session_version` presente; origem inalterada |
| Guardrail | `assertRestoreTargetAllowed` recusa mesmo host+database |

**Não** foi feito restore a partir de dump de **produção** (sem acesso a `DATABASE_URL`/volume/`BACKUP_DIR` do Coolify).

#### Documentos (uploads)

| Item | Resultado |
| --- | --- |
| Armazenamento | Disco `/app/uploads` (volume); S3 opcional no código — não confirmado em prod |
| Prova de backup | **PENDENTE** — `writable=true` ≠ recuperabilidade |
| Restore amostra | Não executado (sem acesso ao volume) |

### Etapa 3 — Redis, workers, SMTP, monitoramento

| Componente | Produção | Notas |
| --- | --- | --- |
| Redis | APROVADO | ping OK, mode redis |
| Workers | APROVADO | heartbeat recente; filas zeradas |
| SMTP | Config OK / entrega PENDENTE | Teste de inbox após UI voltar |
| Sentry | REPROVADO | Sem DSN |
| Degradação sem Redis | Código: produção exige Redis no boot (`assertRedisReachableInProduction`) | Não forçamos queda em produção |

### Etapa 4 — Migration `session_version`

| Item | Status |
| --- | --- |
| SQL / schema / auth | Revisados — compatível (default 0; JWT antigo tratado como `sv=0`) |
| Guia | `docs/SESSION-VERSION-DEPLOY.md` |
| Local | APROVADO — `prisma migrate status` up to date; coluna presente |
| Produção | **PENDENTE** — não aplicada nesta sessão (sem backup de prod verificado + sem acesso ao container). Login prod com credenciais fictícias → 401 (não prova a coluna). |
| Rollback | Documentado no guia; não rodar `migrate reset` em prod |

**Não publicar** até: dump recente de prod OK + `npx prisma migrate deploy` no container + smoke login/change-password.

### Etapa 5 — Stripe teste

| Item | Status |
| --- | --- |
| Separação keys | PENDENTE (painel) |
| Prices em API | REPROVADO (`priceConfigured=false`) |
| Checkout cartão teste | PENDENTE (sem `sk_test` local + UI offline + prices) |
| Webhook signature gate | APROVADO (400 sem header) |
| Idempotência | Ver abaixo |

#### Idempotência (código + testes)

- **Não** há ledger de `event.id` (confirmado por teste de contrato).
- Idempotência operacional = `applySubscription` regrava os mesmos campos do tenant (subscription_id único na prática via update).
- Integração `billingWebhookReplay.integration.test.js`: replay 2× não duplica tenant (local, `RUN_DB_TESTS=1`).
- **Correção nesta rodada:** `handleCheckoutCompleted` **não** ativa mais `subscription_status=active` quando `checkout.session.completed` chega **sem** `subscription_id` (checkout ATrack é sempre `mode=subscription`). Evita ativação indevida.
- Risco residual: eventos fora de ordem (ex.: `updated` atrasado após `deleted`) são last-write-wins sem dedupe por `event.id` — aceitável para Starter se webhooks forem processados rápido; ledger opcional depois.

### Etapa 6 — Live Stripe (sem cobrança real)

Checklist de prontidão (revisão **sem** transação):

| # | Item | Estado |
| --- | --- | --- |
| 1 | `STRIPE_SECRET_KEY` live separado de test | PENDENTE (proprietário) |
| 2 | `STRIPE_WEBHOOK_SECRET` endpoint **live** ≠ test | PENDENTE |
| 3 | Webhook URL `https://api-abbroto.jwsoftware.com.br/api/billing/webhook` | Endpoint existe; eventos/secret PENDENTE |
| 4 | `STRIPE_PRICE_STARTER` / `FISCAL` / `COMPLETE` | **Faltando** na API atual |
| 5 | Produtos modo subscription no Dashboard | PENDENTE |
| 6 | `FRONTEND_URL` / success URLs HTTPS do front | Front atualmente 503 |
| 7 | Autorização explícita antes de 1ª cobrança real | Obrigatória — **não feita** |

### Etapa 7 — Regressão

| Suite | Resultado |
| --- | --- |
| `npm run test:unit` (backend) | **565 pass / 0 fail** |
| Billing webhook contracts (após fix) | **4 pass** |
| `passwordSession` + `tenantIsolation` isolados (`RUN_DB_TESTS=1`) | **pass** |
| Mesmos + outros integration em paralelo | 2 falhas por **interferência** (senha admin / estado compartilhado) — não enfraquecidos; rodar suites críticas isoladas |
| Checkout Stripe E2E | Não executado (bloqueios acima) |
| Frontend build/lint | Não reexecutado nesta rodada (foco operacional) |

---

## Correções realizadas nesta sessão

1. **`BillingService.handleCheckoutCompleted`**: remove ativação de assinatura sem `subscription_id`.
2. **Testes** em `billingWebhookIdempotency.test.js` ampliados (contrato de segurança + deleted).
3. **Documentação**: este arquivo, `COOLIFY-STARTER-VERIFY.md` atualizado, `STARTER-OPERATIONS-RUNBOOK.md` criado.
4. **`.gitignore`**: `backend/backups/` para não versionar dumps.

Nenhuma alteração de Environment Variables, Stripe live, ou migration em produção.

---

## Pendências do proprietário (ordem sugerida)

1. **Restaurar frontend** no Coolify (503 Traefik) — ver runbook.
2. Ativar **BACKUP_ENABLED** + volume `/app/backups`; confirmar `backup.last` no `/health`; agendar backup do volume **uploads**.
3. Configurar **Stripe test**: secret, webhook secret, três price IDs; checkout + Resend.
4. Configurar **Sentry** (API + `VITE_SENTRY_DSN`).
5. Prova SMTP (convite ou reset) em caixa controlada.
6. Confirmar `migrate status` / aplicar `session_version` **só** com dump recente.
7. Só então: checklist live + autorização para cobrança real.

## Riscos residuais

- Uploads só em disco sem backup comprovado → perda irreversível de PDFs/XML.
- Webhooks Stripe sem ledger de `event.id`.
- Frontend e API podem divergir de versão se só um serviço for redeployado.
- Integração de testes com admin compartilhado é sensível a corrida quando paralelizada.
