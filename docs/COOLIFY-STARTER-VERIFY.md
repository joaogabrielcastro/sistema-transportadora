# Verificação operacional Coolify (Starter) — sem expor segredos

Checklist executado em **2026-10-26**. Evidências públicas via `curl` nos hosts
`abbroto.jwsoftware.com.br` e `api-abbroto.jwsoftware.com.br`. Itens que exigem
painel Coolify / SSH / Dashboard Stripe / Sentry ficam **PENDENTE** até ação do
proprietário — não inventamos confirmação de Environment Variables.

Legenda: `APROVADO` | `REPROVADO` | `PENDENTE` | `NÃO APLICÁVEL`

## Passos exatos

### 0. Deploy falhou com aviso `NODE_ENV=production` no build

| Status | Evidência |
| --- | --- |
| **PENDENTE** | Sem acesso ao painel Coolify nesta sessão. O `frontend/Dockerfile` já usa `npm ci --include=dev`. O site público responde **503** `no available server` (Traefik sem backend saudável) — ver item Frontend abaixo. |

Ação do proprietário:

1. Coolify → Frontend → Environment: `NODE_ENV=production` só em **Runtime**.
2. Conferir container Running (não unhealthy/exited), Ports Exposes `80`, healthcheck `/health`.
3. Redeploy com Clear build cache se necessário; logs além do aviso amarelo.

### 1. Auth

| Status | Evidência |
| --- | --- |
| **APROVADO** (API auth path) | `POST /api/auth/login` com credenciais fictícias → **401** `Credenciais inválidas` (não 500). `GET /api/auth/me` sem token → **401**. `POST /api/auth/register` corpo vazio → **400**. |
| **REPROVADO** (prova UI `/login`) | Frontend **503** — impossível abrir `/login` no domínio público. |
| **PENDENTE** (env no Coolify) | Confirmar no painel: `AUTH_ENABLED=true`, `JWT_SECRET` (≥16), `CORS_ORIGINS`, `FRONTEND_URL`. |

Comandos:

```powershell
curl.exe -s https://api-abbroto.jwsoftware.com.br/api/auth/me
curl.exe -s -X POST https://api-abbroto.jwsoftware.com.br/api/auth/login -H "Content-Type: application/json" --data-binary "@login.json"
```

### 2. Redis + worker

| Status | Evidência |
| --- | --- |
| **APROVADO** | `GET https://api-abbroto.jwsoftware.com.br/health` (2026-10-26T18:10:38Z): `redis.configured=true`, `redis.ok=true`, `queueMode=redis`, `worker.ok=true`, `worker.ageMs≈2282`, filas `ordemColeta`/`averbacao`/`telemetry` com waiting/active/failed = 0. |

Não depende do `.env` local (lá não há `REDIS_URL`). Produção real está em Redis.

### 3. SMTP

| Status | Evidência |
| --- | --- |
| **APROVADO** (configuração detectada) | `/health` → `mail.configured=true`. |
| **PENDENTE** (entrega observável) | Sem caixa de teste / painel: não foi criado convite nem “esqueci a senha” em produção. |

Ação: após Frontend voltar, convite com vaga livre **ou** forgot-password para caixa controlada; confirmar inbox (não logar tokens).

### 4. Stripe (modo teste primeiro)

| Status | Evidência |
| --- | --- |
| **REPROVADO** (preços) | `GET /api/billing/plans` → todos os planos com `priceConfigured=false` (faltam `STRIPE_PRICE_STARTER` / `FISCAL` / `COMPLETE` no ambiente da API). |
| **APROVADO** (endpoint webhook existe) | `POST /api/billing/webhook` sem assinatura → **400** `Assinatura Stripe ausente`. |
| **PENDENTE** | Checkout com `sk_test_…`, eventos no Dashboard, Resend, prova de idempotência em tenant real de teste. Sem chaves de teste no `.env` local desta máquina. |

### 5. Monitoramento

| Status | Evidência |
| --- | --- |
| **REPROVADO** / gap | `/health` → `sentry.configured=false`. Sem DSN, 500s da API não vão para Sentry. |
| **PENDENTE** | Criar projetos Sentry (API + Front), setar `SENTRY_DSN` e `VITE_SENTRY_DSN` (build arg), forçar erro controlado em staging. |

### 6. Backup

| Status | Evidência |
| --- | --- |
| **REPROVADO** (produção) | `/health` → `backup.enabled=false`, `backup.last=null`. Dump diário da API **não** está ativo. |
| **APROVADO** (procedimento local) | Drill em Postgres local (Docker): dump gzip válido → restore em banco `atrack_restore` isolado → contagens tenants/users iguais à origem; origem intacta. Guard `assertRestoreTargetAllowed` recusa mesmo host+database. |
| **PENDENTE** (uploads) | `/health` → `uploads.writable=true` (volume gravável ≠ backup). Sem S3/R2 confirmado via health. Backup do volume `/app/uploads` no Coolify não verificado. |

Variáveis a ativar na API (Coolify):

```
BACKUP_ENABLED=true
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=7
BACKUP_HOUR_UTC=6
```

Volume mount: `/app/backups`. Depois: `/health` deve mostrar `backup.enabled=true` e `backup.last.ok=true` após o horário agendado (ou `npm run db:backup` one-off no container).

## Frontend público (extra — bloqueante)

| Status | Evidência |
| --- | --- |
| **REPROVADO** | `curl.exe -sI https://abbroto.jwsoftware.com.br` → **503**, body `no available server`. Significa Traefik sem container saudável para o domínio (serviço parado, healthcheck falhando, porta errada ou proxy). API permanece **200** `healthy`. |

Diagnóstico sugerido no servidor/Coolify: `docker ps` do serviço frontend; logs; Ports Exposes `80`; health `wget …/health`; Restart/Redeploy.

## Resumo rápido

| Item | Produção real | Local / teste |
| --- | --- | --- |
| Auth API | parcial (401 paths OK; UI offline) | OK em testes |
| Redis + worker | APROVADO | Redis local sobe via compose |
| SMTP | configurado; entrega PENDENTE | Mailpit / ausente no `.env` |
| Stripe prices | REPROVADO (`priceConfigured=false`) | ausente |
| Sentry | REPROVADO | ausente |
| Backup DB | REPROVADO (disabled) | restore drill APROVADO |
| Uploads backup | PENDENTE | N/A |
| Frontend | REPROVADO (503) | N/A nesta rodada |
