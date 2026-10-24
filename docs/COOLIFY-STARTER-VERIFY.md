# Verificação operacional Coolify (Starter) — sem expor segredos

Use no painel Coolify da API ATrack. Marque só o que **você** confirmar. Nesta sessão de preparação local: várias variáveis **não** estavam no `.env` local (SMTP/Stripe/Sentry/Backup ausentes no arquivo; Redis apontando para memória).

## Passos exatos

### 0. Deploy falhou com aviso `NODE_ENV=production` no build
1. Coolify → serviço que falhou (API e/ou Frontend) → **Environment**.
2. Em `NODE_ENV=production`, desmarque **Available at Buildtime** / marque só **Runtime**.
3. No **Frontend**, o build precisa de Vite (`devDependencies`). O `frontend/Dockerfile` já usa `npm ci --include=dev` para resistir a `NODE_ENV=production` injetado no build; ainda assim, prefira Runtime-only.
4. Redeploy o commit. Se ainda falhar, role o log **além** do aviso amarelo — a causa real costuma aparecer depois de “Building docker image started”.

### 1. Auth
1. Coolify → serviço **API** → Environment.
2. Confirme presença (valores ocultos OK): `AUTH_ENABLED=true`, `JWT_SECRET` (≥16 chars), `CORS_ORIGINS` com o domínio do front, `FRONTEND_URL` com URL pública do app.
3. Prova: abrir `/login`, autenticar, `/api/auth/me` 200. Com `AUTH_ENABLED=false` a API **não** deve subir em produção (`validateProduction`).

### 2. Redis + worker
1. Confirme `REDIS_URL` apontando para o Redis interno Coolify.
2. Se worker separado: mesmo `REDIS_URL`/`DATABASE_URL`; health em `WORKER_HEALTH_PORT` (padrão 3021).
3. Prova: `GET /health` → `redis.configured=true`, `redis.ok=true`, `queueMode` ≠ `memory`.

### 3. SMTP
1. Confirme `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
2. Prova: criar convite com vaga livre e receber e-mail; ou “esqueci a senha” para caixa de teste. `/health` → `mail.configured=true`.

### 4. Stripe (modo teste primeiro)
1. Confirme `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET` (whsec_…), `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_FISCAL`, `STRIPE_PRICE_COMPLETE`.
2. Webhook no Dashboard Stripe → `https://SEU_API/api/billing/webhook` com eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
3. Prova: checkout teste em `/assinatura`; no Dashboard, “Resend” do evento e conferir que o tenant não duplica assinatura (update idempotente).

### 5. Monitoramento
1. API: `SENTRY_DSN`. Front (build arg): `VITE_SENTRY_DSN`.
2. Prova: `/health` → `sentry.configured=true`; forçar erro controlado em staging e ver evento no Sentry.

### 6. Backup
1. `BACKUP_ENABLED=true`, `BACKUP_DIR=/app/uploads` volume **ou** `/app/backups`, retenção configurada.
2. Prova: arquivo `.sql.gz` recente no volume; `/health` → `backup.enabled=true` e `backup.last` sem erro.
3. Restore: **somente** em banco vazio diferente — ver script `npm run db:restore` (recusa mesmo host+database de `DATABASE_URL`).

## O que esta preparação local já mostrou

| Item | Config encontrada (local) | Funcionamento comprovado |
| --- | --- | --- |
| Auth | `AUTH_ENABLED=true`, JWT set | Login/register/me OK |
| Redis | sem `REDIS_URL` → memória | Fila em memória (não é prod) |
| SMTP | injetado só no processo → Mailpit | Convite/reset (script dedicado) |
| Stripe | ausente no `.env` | Checkout 503; CLI sem login |
| Sentry | ausente | não configurado |
| Backup | `backup.enabled=false` no `/health` | restore isolado (se executado nesta rodada) |
