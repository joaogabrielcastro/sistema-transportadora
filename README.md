# ATrack — Gestão de Frotas

SaaS **multi-empresa** para transportadoras: frota, gastos, manutenção, pneus, documentos, relatórios e, nos planos Fiscal/Completo, NF-e, estoque e emissão de CT-e / MDF-e / CIOT.

Site comercial → plano (LID) → cadastro → sistema. Tudo deve contar a mesma história.

## Arquitetura

- **Backend:** Node.js, Express, Prisma 7, PostgreSQL, Zod, JWT.
- **Frontend:** React, Vite, Tailwind, TanStack Query, Chart.js.
- **Isolamento:** banco compartilhado com `tenant_id` em todas as tabelas de negócio (sem RLS).
- **Filas:** Redis + BullMQ (ordem de coleta e averbação). Sem Redis, a fila fica em memória (dev/test).

## O que o produto entrega

### Em todos os planos públicos

Dashboard, frota (truck / cavalo / carreta), composição, motoristas, documentos do veículo, pneus (uso e estoque), gastos, checklist/manutenção, alertas, relatórios (custo por km), usuários e auditoria.

### Fiscal e Completo

Além do Starter:

- Importação de XML da NF-e e cadastro manual de notas
- Estoque de peças ligado à frota e baixa na manutenção
- Empresa fiscal, certificado, CT-e, MDF-e, seguro/averbação e contrato de frete (CIOT)

A operação ainda precisa cadastrar empresa fiscal e certificado para emitir.

### Não vendido nos planos públicos

- **Ordem de coleta** (PDF / e-mail): exclusiva do tenant ABroto (`slug=abbroto`).
- Plano legado **`ops`**: não aparece no site nem no checkout. LID inválido.

## Planos (catálogo oficial)

Fonte de verdade: `backend/src/utils/planCatalog.js` + `planQuotas.js` + `tenantFeatures.js`.

O frontend consome `GET /api/billing/plans`. Fallback local em `frontend/src/utils/billing.js` deve espelhar o catálogo.

| LID | Nome | Preço | Frota / usuários | Trial | Módulos |
|-----|------|-------|------------------|-------|---------|
| `starter` | Starter | R$ 199/mês | 8 / 2 | 14 dias | frota operacional |
| `fiscal` | Fiscal | R$ 499/mês | 40 / 8 | — | `notas_estoque` + `transporte_fiscal` |
| `complete` | Completo | R$ 699/mês | 100 / 20 | — | mesmos do Fiscal |

**LID** = id do catálogo (`starter` \| `fiscal` \| `complete`). O frontend **nunca** envia Stripe Price ID. O backend resolve LID → plano → Price ID.

Funil: `/planos` → `/planos/:lid` → `/register?lid=…` → assinatura → checkout Stripe.

Rotas públicas: `/`, `/planos`, `/planos/:lid`, `/login`, `/register`, `/termos`, `/privacidade`. `/precos` redireciona para `/planos`.

## Multi-tenant e acesso

- Login por **e-mail + senha** (e-mail único no sistema); o tenant vem do usuário.
- Cadastro público: `POST /api/auth/register` e `/register` (desligar com `ALLOW_PUBLIC_REGISTER=false` / `VITE_ALLOW_PUBLIC_REGISTER=false`).
- Papéis: `admin` \| `operator` \| `viewer`. Admin gerencia a equipe em `/usuarios`.
- Clientes atuais (pré-cobrança): `billing_exempt=true` — usam o sistema sem Stripe.
- Novos tenants: trial de 14 dias no **Starter**, depois assinam em `/assinatura`.
- Novo tenant (CLI):
  `cd backend && npm run tenant:create -- --slug=empresa --nome="Empresa" --email=admin@empresa.com --password=SenhaSegura123`
- Ativar cobrança em isento: `npm run tenant:billing -- --slug=empresa --exempt=false --plan=fiscal`

## Operação avançada

- Alertas / documentos / motoristas: `/alertas`, `/documentos`, `/motoristas`
- Digest semanal: `npm run job:weekly-digest` (cron sugerido: segunda 8h)
- Worker PDF: por padrão na API; `RUN_ORDEM_WORKER_IN_API=false` + `npm run worker:ordem-coleta` para processo separado
- S3 (`S3_BUCKET` + keys): uploads saem do disco local
- WhatsApp: `WHATSAPP_API_URL` + `WHATSAPP_TOKEN` — `POST /api/ops/whatsapp/test`
- Auditoria: `GET /api/ops/audit-logs` (admin)
- Fiscal Brasil NFe: ver [`docs/FISCAL-BRASIL-NFE.md`](docs/FISCAL-BRASIL-NFE.md)
- Averbação: ver [`docs/AVERBACAO-SEGURO.md`](docs/AVERBACAO-SEGURO.md)

## Estrutura

- `backend/` — API, Prisma, workers, testes
- `frontend/` — SPA (site comercial + app autenticado)
- `docs/` — Coolify, fiscal, averbação

## Como rodar (local)

Postgres na raiz:

```bash
docker compose up -d
```

Host **5434** → ver `backend/.env.example`. Redis opcional: `docker compose up -d redis`.

### Backend

```bash
cd backend
cp .env.example .env   # se ainda não existir
npm install
npm run dev            # http://localhost:3020
```

Seed típico: `admin@abrotto.local` / `admin123456` (tenant `abbroto`).

### Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3020
npm install
npm run dev            # http://localhost:5173
```

Site comercial só aparece **deslogado** em `/`. Logado, `/` é o dashboard.

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Função |
|----------|--------|
| `DATABASE_URL` | PostgreSQL |
| `PRISMA_CLIENT_ENGINE_TYPE` | use `library` |
| `PORT` | padrão `3020` |
| `AUTH_ENABLED` | `true` em produção |
| `JWT_SECRET` | ≥16 caracteres em produção |
| `CORS_ORIGINS` | CSV de origens |
| `ALLOW_PUBLIC_REGISTER` | cadastro de empresas |
| `FRONTEND_URL` | links de convite, reset e retorno Stripe |
| `REDIS_URL` | fila durable |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | cobrança |
| `STRIPE_PRICE_STARTER` / `_FISCAL` / `_COMPLETE` | Price IDs (nunca no frontend) |
| `BRASIL_NFE_*` / `FISCAL_SECRETS_KEY` | emissão fiscal |

Lista completa: `backend/.env.example`.

### Frontend (`frontend/.env`)

```bash
VITE_API_URL=http://localhost:3020
VITE_AUTH_REQUIRED=true
# VITE_ALLOW_PUBLIC_REGISTER=false
```

Produção: `VITE_API_URL=https://api.seudominio.com.br` (sem `/api` no final).

## Billing (Stripe)

- Webhook: `POST /api/billing/webhook` (raw body). Local: `stripe listen --forward-to localhost:3020/api/billing/webhook`
- Checkout recebe `{ lid }` (ou legado `{ plan }`). Metadata Stripe inclui `lid`.
- LID inválido / `ops` → 400 (`LID_INVALID`).

## Qualidade

### Backend

```bash
cd backend
npm run lint
npm run test:unit
npm test                 # unit + integração (precisa Postgres)
```

### Frontend

```bash
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e        # Playwright (preview :4173)
```

### CI (GitHub Actions)

Push/PR em `main` ou `master`: lint + testes backend, lint + build frontend (`.github/workflows/ci.yml`).

## Relatórios (API)

- `GET /api/reports/overview`
- `GET /api/reports/cost-per-km?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&caminhaoId=1`
- `GET /api/reports/cost-per-km-trend`

## Deploy (Coolify)

Use **Dockerfile**, não Nixpacks. Detalhes e 502/PWA: [`docs/COOLIFY-CHECKLIST.md`](docs/COOLIFY-CHECKLIST.md).

### Backend

1. Build Pack: Dockerfile · base `backend` (ou raiz com `Dockerfile` que copia `backend/`)
2. Volume **`/app/uploads`** (PDFs dos caminhões)
3. Não defina `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` — o `prestart` instala Chrome em `/app/.cache/puppeteer`. Confira `/health` → `pdf.chromiumPath`
4. Mínimo: `DATABASE_URL`, `PORT`, `REDIS_URL`, SMTP, `NODE_ENV=production`, `AUTH_ENABLED=true`, `JWT_SECRET`, `CORS_ORIGINS`

### Frontend

1. Base `frontend` · Dockerfile · porta **80**
2. Build args: `VITE_API_URL=https://api.seudominio.com.br` · `VITE_AUTH_REQUIRED=true`
3. Redeploy com clear cache

O frontend **não** embute token no bundle. JWT fica no `localStorage` após `/login`. Não configure `VITE_API_TOKEN`.

### Banco já existente (Prisma P3005)

```bash
cd backend
npm run db:migrate
```

## Observações de produção

- `DB_SSL_MODE=require` para validar certificado. Evite `no-verify` fora de cenário temporário.
- `/health` retorna **503** (`status: "degraded"`) se banco, PDF ou uploads falharem.
- Backup: `BACKUP_ENABLED=true` ou `npm run db:backup`, mais o volume `/app/uploads`.
