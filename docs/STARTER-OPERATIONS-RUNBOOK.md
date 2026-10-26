# Runbook operacional — ATrack Starter

Procedimentos curtos para backup, restore, incidentes e checagens. Sem segredos.
Complementa `docs/COOLIFY-CHECKLIST.md` e `docs/COOLIFY-STARTER-VERIFY.md`.

## 1. Health rápido

```powershell
curl.exe -sI https://abbroto.jwsoftware.com.br
curl.exe -s https://api-abbroto.jwsoftware.com.br/health
```

Esperado:

| Alvo | Esperado |
| --- | --- |
| Front | HTTP 200 |
| API | HTTP 200, `status=healthy`, `database.ok`, `redis.ok`, `worker.ok` |

Se front = **503** `no available server` e API = 200 → problema só no serviço frontend / Traefik (não no Postgres).

## 2. Frontend 503 (Traefik sem backend)

1. Coolify → app Frontend → status Running? Logs de crash/OOM?
2. Configuration: **Ports Exposes = 80**, domínio `abbroto.jwsoftware.com.br`.
3. Healthcheck: path `/health` (nginx já responde `ok`). Imagem inclui `wget`.
4. No host (SSH): `docker ps` — container unhealthy/exited?
5. Proxy logs: Coolify → Server → Proxy → Logs (erros Docker API / Traefik).
6. Redeploy com Clear build cache; se healthcheck falso positivo, corrigir porta/path antes de desligar o check.
7. Validar: `curl.exe -sI https://abbroto.jwsoftware.com.br` → 200; `/health` → `ok`.

## 3. Backup do PostgreSQL

### Ativar (API Coolify)

```
BACKUP_ENABLED=true
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=7
BACKUP_HOUR_UTC=6
```

Monte volume em `/app/backups`. Imagem da API já traz `pg_dump`/`psql`.

One-off no container:

```bash
npm run db:backup -- --out=/app/backups
```

Prova: arquivo `atrack-*.sql.gz` + `/health` → `backup.enabled=true` e `backup.last.ok=true`.

Opcional: S3/R2 (`S3_*` + prefixo `BACKUP_S3_PREFIX`) para cópia fora do disco do app.

### Restore (nunca no banco de produção)

1. Crie banco **vazio** em outro database (mesmo host OK se o **nome** for diferente).
2. No ambiente com `DATABASE_URL` = origem e `RESTORE_TARGET_URL` = destino:

```bash
npm run db:restore -- --file=/app/backups/atrack-YYYY-….sql.gz --target="$RESTORE_TARGET_URL"
```

O script **recusa** mesmo host + mesmo database.

3. Validar:

```sql
SELECT count(*) FROM tenants;
SELECT count(*) FROM users;
SELECT column_name FROM information_schema.columns
  WHERE table_name='users' AND column_name='session_version';
```

4. Só promova restore para produção após decisão humana e janela de manutenção.

## 4. Backup de uploads (documentos)

- Path padrão: `/app/uploads` (volume Coolify obrigatório).
- Persistência ≠ backup. Agende snapshot/cópia do volume (Coolify backup, rsync, ou S3 se o módulo usar object storage).
- Após restore de arquivos, conferir que caminhos no banco ainda resolvem (amostra de caminhão/documento **sem** expor PII em tickets).

## 5. Redis / workers

- API precisa de `REDIS_URL` interno. `/health`: `queueMode=redis`, `worker.ok=true`.
- Worker embutido: `RUN_ORDEM_WORKER_IN_API` true/ausente.
- Worker separado: API com `RUN_ORDEM_WORKER_IN_API=false` + serviço `npm run worker`, mesmas `DATABASE_URL`/`REDIS_URL`, health `:3021/health`.
- Filas com `failed` crescendo: logs da API/worker; reprocessar com cuidado (evitar efeitos duplicados em e-mail/PDF).

## 6. SMTP

Variáveis: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

Prova segura: forgot-password ou convite para **caixa de teste** controlada. Não cole tokens/links sensíveis em issues públicas.

Falha típica: senha de app / 2FA — mensagem da API orienta conferir `SMTP_USER`/`SMTP_PASS`.

## 7. Monitoramento de erros

| Camada | Variável | Onde |
| --- | --- | --- |
| API | `SENTRY_DSN` | Runtime Coolify |
| Front | `VITE_SENTRY_DSN` | **Build argument** do frontend |

Sem DSN o app sobe; só não há alerta centralizado. Alternativa mínima: logs Coolify + alarme em `status=degraded` no `/health` (uptime monitor externo batendo a cada 1–5 min).

Como investigar um 500:

1. `X-Request-Id` da resposta (header da API).
2. Logs do container filtrando esse id.
3. Se Sentry: evento com o mesmo request id / release.

Não logar senhas, JWT, corpo de upload, XML fiscal completo em canais públicos.

## 8. Stripe (teste → live)

### Teste

1. `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (endpoint de teste).
2. `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_FISCAL`, `STRIPE_PRICE_COMPLETE`.
3. Dashboard → Webhook → `https://api-…/api/billing/webhook` com `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
4. Checkout com [cartões de teste](https://stripe.com/docs/testing); confirmar tenant atualizado.
5. **Resend** do mesmo evento: tenant não deve duplicar assinatura.
6. Checkout **não** deve ativar plano sem `subscription` no evento (código atual recusa esse caminho).

### Live (sem cobrança até autorização)

- Keys/secrets/prices/webhook **separados** do modo test.
- Confirmar produtos subscription e URLs HTTPS.
- Primeira cobrança real só com OK explícito do proprietário.

## 9. Migration `session_version`

Ver `docs/SESSION-VERSION-DEPLOY.md`.

Ordem: backup Postgres → `npx prisma migrate deploy` no container API → restart → login → troca de senha invalida JWT antigo.

Não usar `migrate reset` em produção.

## 10. Contatos / escalação mínima

1. Front ou API down → health + Coolify logs (seção 1–2).
2. Dados → backup/restore (seção 3–4).
3. Fila/PDF travado → Redis/worker (seção 5).
4. E-mail → SMTP (seção 6).
5. Cobrança → Stripe Dashboard + logs webhook (seção 8).
