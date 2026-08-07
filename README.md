# ATrack — Gestão de Frotas

Plataforma **multi-empresa** (SaaS) para gestão de frota, manutenção, pneus, gastos e ordens de coleta.

## Arquitetura

- Backend: Node.js, Express, Prisma ORM, PostgreSQL, Zod, JWT.
- Frontend: React, Vite, Tailwind, Axios, Chart.js.
- Isolamento: banco compartilhado com `tenant_id` em todas as tabelas de negócio.

## Multi-tenant e acesso

- Login por **e-mail + senha** (e-mail único no sistema); o tenant vem do usuário.
- Cadastro público de empresa: `POST /api/auth/register` e rota frontend `/register` (desligar com `ALLOW_PUBLIC_REGISTER=false` / `VITE_ALLOW_PUBLIC_REGISTER=false`).
- Papéis **dentro** do tenant: `admin` | `operator`. Admin gerencia usuários em `/usuarios`.
- Seed histórico: tenant `slug=abbroto` (dados migrados). Novos tenants via UI ou CLI:
  `cd backend && npm run tenant:create -- --slug=empresa --nome="Empresa" --email=admin@empresa.com --password=SenhaSegura123`

## Billing (Stripe)

- **Clientes atuais** (pré-migração): `billing_exempt=true` — usam o sistema sem Stripe e sem tela de cobrança.
- **Novos tenants** (register ou `tenant:create` sem `--exempt=true`): trial de 14 dias no plano **ops**, depois precisam assinar em `/assinatura`.
- Planos: `starter` | `ops` (ordem de coleta) | `fiscal` (NF-e/estoque) | `complete` (ambos).
- Ativar cobrança depois em um isento: `npm run tenant:billing -- --slug=empresa --exempt=false --plan=ops`
- Webhook: `POST /api/billing/webhook` (raw body). Local: `stripe listen --forward-to localhost:3020/api/billing/webhook`

## Operação avançada

- **Alertas / documentos / motoristas:** `/alertas`, `/documentos`, `/motoristas` (+ APIs `/api/ops/*`, `/api/motoristas`)
- **Digest semanal:** `npm run job:weekly-digest` (cron recomendado: segunda 8h)
- **Worker PDF:** em produção `REDIS_URL` obrigatório; `RUN_ORDEM_WORKER_IN_API=false` + `npm run worker:ordem-coleta`
- **S3:** `S3_BUCKET` + keys (AWS/R2/MinIO) — uploads de documentos saem do disco local
- **WhatsApp:** `WHATSAPP_API_URL` + `WHATSAPP_TOKEN` — teste em `POST /api/ops/whatsapp/test`
- **Auditoria:** mutações gravadas em `audit_logs`; listar em `GET /api/ops/audit-logs` (admin)
- **RBAC:** permissões por role (`admin`/`operator`) + extras em `users.permissions`

## Principais recursos

- Frota (caminhões), pneus, manutenção/gastos, relatórios, ordem de coleta (PDF + e-mail).
- Upload de documentos por caminhão.
- CORS, rate limit, auditoria de mutações, health check com probe de Chromium para PDF.

## Estrutura

- backend/: API e acesso a dados.
- frontend/: SPA React.

## Variáveis de Ambiente

### Backend (`backend/.env`)

- `DATABASE_URL`: string de conexão PostgreSQL.
- `PRISMA_CLIENT_ENGINE_TYPE`: **use `library`** em Docker/Node (evita o Prisma “edge/client” exigir `adapter`/`accelerateUrl`).
- `PORT`: porta da API (default `3020` no `server.js`; defina no Coolify/host).
- `NODE_ENV`: `development` ou `production`.
- `CORS_ORIGINS`: lista CSV de origens permitidas.
- `DB_SSL_MODE`: `require`, `no-verify` ou `disable`.
- `RATE_LIMIT_WINDOW_MS`: janela de rate limit em ms.
- `RATE_LIMIT_MAX`: limite de requests por janela.
- `AUTH_ENABLED`: `true`/`false` para exigir token.
- `JWT_SECRET`: chave para assinar tokens JWT (obrigatório em produção, ≥16 caracteres).
- `API_TOKEN`: opcional — token fixo para scripts/CI (não use no frontend).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: primeiro admin do tenant seed `abbroto` se esse tenant ainda não tiver usuários.
- `DEFAULT_TENANT_ID`: tenant usado quando `AUTH_ENABLED=false` ou API token.
- `ALLOW_PUBLIC_REGISTER`: `false` desliga cadastro de novas empresas (padrão: habilitado).
- `REDIS_URL`: Redis para fila durable de ordem de coleta (BullMQ). Sem isso, a fila fica em memória.

### Frontend (`frontend/.env`)

- `VITE_API_URL`: URL base da API sem `/api`.
- `VITE_AUTH_REQUIRED`: `true` em produção para exigir login JWT.
- `VITE_ALLOW_PUBLIC_REGISTER`: `false` esconde o link “Criar conta” (alinhar com o backend).

Exemplo (desenvolvimento local):

```bash
VITE_API_URL=http://localhost:3020
VITE_AUTH_REQUIRED=true
```

Exemplo (build de produção):

```bash
VITE_API_URL=https://api.seudominio.com.br
VITE_AUTH_REQUIRED=true
```

Desenvolvimento local com Postgres via Docker: na raiz do projeto, `docker compose up -d` (porta **5434** no host; veja `backend/.env.example`).

### Deploy do backend (Coolify)

O log `FROM ghcr.io/railwayapp/nixpacks` indica que o Coolify está usando **Nixpacks** (build longo, costuma dar timeout). Troque para **Dockerfile**.

1. Serviço da API → **Configuration** → **Build**
2. **Build Pack / Build Type:** `Dockerfile` (não Nixpacks, não Nixpacks/Railpack automático)
3. Uma das opções:
   - **Base Directory:** `backend` · **Dockerfile:** `Dockerfile`
   - **Base Directory:** `.` (raiz) · **Dockerfile:** `Dockerfile` (copia `backend/`)
4. **Remova** variáveis que forcem Nixpacks; mantenha `DATABASE_URL`, `PORT`, SMTP, etc.
5. **Remova** `PUPPETEER_EXECUTABLE_PATH` do Coolify (se estiver `/usr/bin/chromium`, o PDF quebra). O Dockerfile + `prestart` instalam o Chrome em `/app/.cache/puppeteer`. Confira em `/health` → `pdf.chromiumPath` com caminho válido.
6. **Volume obrigatório** para PDFs dos caminhões: montar **`/app/uploads`** no container (Storage → Volume → mount path `/app/uploads`). Sem isso, a lista aparece no banco mas **Abrir** falha após redeploy — remova e envie os PDFs de novo após configurar o volume.
7. **Redeploy** com “Clear build cache” / rebuild sem cache. Se o build ainda falhar no export, aumente RAM/swap do servidor (≥ 4 GB recomendado no build).

Variáveis mínimas: `DATABASE_URL`, `PORT` (ex.: 3020), `REDIS_URL` (fila ordem de coleta), SMTP se for enviar e-mail.

**Segurança em produção (obrigatório):**

| Backend (Coolify) | Frontend (build arg) |
|-------------------|----------------------|
| `NODE_ENV=production` | `VITE_API_URL` |
| `AUTH_ENABLED=true` | `VITE_AUTH_REQUIRED=true` |
| `JWT_SECRET=` senha longa aleatória (≥16 chars) | |
| `CORS_ORIGINS=https://abbroto.jwsoftware.com.br` | |

O frontend **não** embute token no bundle. Usuários fazem login em `/login` e o JWT fica no `localStorage`.

`API_TOKEN` no backend é opcional (scripts/CI); não configure `VITE_API_TOKEN`.

### Ordens de coleta (envio assíncrono)

1. `POST /api/ordem-coleta/enviar` responde **202** e enfileira PDF + e-mail.
2. O frontend consulta `GET /api/ordem-coleta/envio/:id` até o status ser `sent` ou `failed`.
3. Envios interrompidos por restart do servidor são **retomados automaticamente** ao subir a API (registros com `enviado_em` e `erro_envio` nulos).
4. O histórico mostra status **Processando…** enquanto o job roda.

### Deploy do frontend (Coolify)

1. Serviço do site → **Build** → **Build Pack:** `Dockerfile`
2. **Base Directory:** `frontend` · **Dockerfile:** `Dockerfile`
3. **Porta exposta no container:** `80` (nginx)
4. **Build argument** (obrigatório em produção): `VITE_API_URL=https://api-abbroto.jwsoftware.com.br` (URL da API **sem** `/api` no final)
5. **Build argument:** `VITE_AUTH_REQUIRED=true`
6. Redeploy com **Clear build cache**

Se aparecer `open Dockerfile: no such file or directory`, a base directory não é `frontend` ou o Dockerfile ainda não foi enviado ao repositório.

**502 Bad Gateway** no site com API saudável (`/health` 200): o container do frontend está parado ou com porta errada — não é causado por limpar storage do navegador. Checklist completo: [`docs/COOLIFY-CHECKLIST.md`](docs/COOLIFY-CHECKLIST.md).

**Versão antiga em alguns PCs:** PWA/service worker + cache do nginx; após redeploy, peça para fechar todas as abas do domínio ou limpar service worker (ver checklist).

### Banco de produção já existente (erro P3005)

Se `npx prisma migrate deploy` retornar *database schema is not empty*, o banco foi criado antes do histórico do Migrate. No backend:

```bash
npm run db:migrate
```

Isso marca migrações antigas como aplicadas e aplica só o que faltar (ex.: `caminhao_documentos`).

## Como Rodar

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Qualidade

### Backend

```bash
cd backend
npm run lint
npm test
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### CI (GitHub Actions)

Em cada push/PR para `main` ou `master`, o workflow `.github/workflows/ci.yml` executa:

- **Backend:** `npm run lint` e `npm test`
- **Frontend:** `npm run lint` e `npm run build`

## Endpoints de Analytics

- `GET /api/reports/overview`
- `GET /api/reports/cost-per-km?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&caminhaoId=1`

## Observações de Produção

- Defina `DB_SSL_MODE=require` para validar certificado.
- Evite `DB_SSL_MODE=no-verify` fora de cenário temporário.
- Ative `AUTH_ENABLED=true`, defina `JWT_SECRET` e faça login em `/login` em produção.
- O endpoint `/health` retorna **503** com `status: "degraded"` se banco, PDF ou uploads falharem — use no monitoramento do Coolify.
- Faça backup periódico do Postgres e do volume `/app/uploads` (ver `docs/COOLIFY-CHECKLIST.md`).
