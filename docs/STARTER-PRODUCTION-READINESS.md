# ATrack Starter — Production Readiness (atualizado 2026-10-26)

Relatório consolidado das pendências operacionais. **Não** é uma auditoria geral do produto.
Segredos, dumps e dados pessoais **não** estão incluídos.

## Classificação

**Apto para demonstrações e trials Starter com acompanhamento.**

**Ainda não recomendado para cobrança live / clientes pagantes sem acompanhamento**, até:

1. Backup periódico do volume `/app/uploads` comprovado (além de `writable`).
2. Troca de `ADMIN_PASSWORD` / `JWT_SECRET` fracos.
3. Go-live Stripe (keys/prices/webhook **live**) com autorização explícita — hoje a API está em **modo teste** (`cs_test_…` no probe).

---

## Situação atual (evidências públicas)

| Item | Status | Evidência |
| --- | --- | --- |
| Frontend | APROVADO | `https://www.atrack.jwsoftware.com.br` → 200 |
| API `/health` | APROVADO | `healthy`; redis/worker/mail/sentry OK |
| Backup Postgres | APROVADO | `backup.enabled=true`, `last.ok=true`, arquivo `atrack-2026-10-26T20-18-15.sql.gz` |
| Stripe prices (test) | APROVADO | `/api/billing/plans` → `priceConfigured=true` nos 3 |
| Checkout + webhook (test) | APROVADO | Probe `stripe-starter-checkout-probe.mjs`: session `cs_test_…`, sub active, webhook 200, replay estável, cancel cleanup |
| Uploads volume | APROVADO (one-off) | `uploads-2026-10-26T20-33-41.tgz` (~12.8 MB) em `/app/backups` — **agendar** cópia periódica ainda recomendado |
| SMTP entrega | PENDENTE | `mail.configured=true`; inbox real não revalidada nesta rodada |
| Stripe **live** | NÃO INICIADO | API segue com `sk_test` / prices test — correto até autorização |

---

## Etapa uploads — procedimento (executar no Coolify)

Sem acesso SSH desta sessão: o proprietário roda no **Terminal** da API.

Pré-requisitos: volume `/app/uploads` + volume `/app/backups` montados.

```bash
# Arquivo em /app/backups (mesmo volume dos dumps SQL) — sem listar nomes de documentos
TS=$(date -u +%Y-%m-%dT%H-%M-%S)
tar -czf "/app/backups/uploads-${TS}.tgz" -C /app uploads
ls -la /app/backups/uploads-${TS}.tgz
# Esperado: tamanho > 0 (mesmo que pequeno se ainda há poucos arquivos)
```

Agendar (Coolify Scheduled Task, ex. diário 04:00):

```bash
cd /app && tar -czf "/app/backups/uploads-$(date -u +%Y-%m-%dT%H-%M-%S).tgz" -C /app uploads && find /app/backups -name 'uploads-*.tgz' -mtime +7 -delete
```

Restore isolado (não sobre produção):

```bash
mkdir -p /tmp/uploads-restore && tar -tzf /app/backups/uploads-YYYY.tgz | head
tar -xzf /app/backups/uploads-YYYY.tgz -C /tmp/uploads-restore
# Conferir contagem de arquivos; não publicar listagens com PII
```

Ideal a médio prazo: copiar esses `.tgz` (e os `.sql.gz`) para S3/R2 fora do disco do app (`S3_*` + `BACKUP_S3_PREFIX` já previstos no código de dump SQL).

---

## Etapa Stripe live — checklist sem cobrança

**Não altere a API para `sk_live` até concluir este checklist e ter OK explícito.**

| # | Ação | Feito? |
| --- | --- | --- |
| 1 | Dashboard Stripe → modo **Live** (toggle) | |
| 2 | Criar produtos/preços live Starter R$249 / Fiscal R$649 / Completo R$999 (subscription mensal) | |
| 3 | Anotar `price_…` live (≠ test `price_1UUtn…`) | |
| 4 | Webhook **live** → `https://api-abbroto.jwsoftware.com.br/api/billing/webhook` (mesmos eventos) | |
| 5 | Novo `whsec_…` **live** (≠ test) | |
| 6 | Coolify API: trocar `STRIPE_SECRET_KEY` → `sk_live_…`, prices live, `STRIPE_WEBHOOK_SECRET` live | |
| 7 | Redeploy API; confirmar que **não** resta `sk_test` no Environment | |
| 8 | Smoke **sem cartão real**: `/api/billing/plans` → `priceConfigured=true` | |
| 9 | Primeira cobrança real só com autorização do proprietário + cliente ciente | |

Enquanto a API estiver em test: demos e trials OK; cartão real do cliente **não** deve ser usado.

Script de probe test (já executado com sucesso): `backend/scripts/stripe-starter-checkout-probe.mjs`.

---

## Pendências restantes do proprietário

1. Rodar o `tar` de uploads (acima) e, se possível, Scheduled Task.
2. Rotacionar credenciais que foram coladas em chat; fortalecer `ADMIN_PASSWORD` e `JWT_SECRET`.
3. Prova SMTP rápida (forgot-password para caixa controlada).
4. Quando for cobrar de verdade: checklist live + OK explícito.
5. Opcional: `DB_SSL_MODE=require` / `no-verify`; offload de uploads para S3.

## Riscos residuais

- Uploads só no disco do servidor sem cópia off-site.
- Webhooks sem ledger de `event.id` (replay idempotente por update de tenant — validado no probe).
- Worker embutido na API (ok no Starter; separar antes de escala).
