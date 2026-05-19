# Sistema de Gestão para Transportadora

Aplicação fullstack para gestão de frota, manutenção, pneus e gastos operacionais.

## Arquitetura Atual

- Backend: Node.js, Express, Prisma ORM, PostgreSQL, Zod.
- Frontend: React, Vite, Tailwind, Axios, Chart.js.

## Principais Melhorias Implementadas

- Migração completa do acesso a dados para Prisma.
- Contrato de API padronizado com envelope `success`, `data`, `message`, `pagination`.
- Regras críticas de atualização de KM movidas para services transacionais.
- Endpoints analíticos server-side para dashboard e relatório de custo por KM.
- CORS orientado por ambiente (`CORS_ORIGINS`).
- Segurança base: rate limit, contexto de requisição e trilha de auditoria para mutações.
- Postura TLS de banco controlada por ambiente (`DB_SSL_MODE`).

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
- `API_TOKEN`: token esperado no header `Authorization: Bearer ...`.
- `ADMIN_ROLES`: lista CSV para papéis administrativos.

### Frontend (`frontend/.env`)

- `VITE_API_URL`: URL base da API sem `/api`.

Exemplo:

```bash
VITE_API_URL=http://localhost:3020
```

Desenvolvimento local com Postgres via Docker: na raiz do projeto, `docker compose up -d` (porta **5433** no host; veja `backend/.env.example`).

### Deploy do backend (Coolify)

O log `FROM ghcr.io/railwayapp/nixpacks` indica que o Coolify está usando **Nixpacks** (build longo, costuma dar timeout). Troque para **Dockerfile**.

1. Serviço da API → **Configuration** → **Build**
2. **Build Pack / Build Type:** `Dockerfile` (não Nixpacks, não Nixpacks/Railpack automático)
3. Uma das opções:
   - **Base Directory:** `backend` · **Dockerfile:** `Dockerfile`
   - **Base Directory:** `.` (raiz) · **Dockerfile:** `Dockerfile` (copia `backend/`)
4. **Remova** variáveis que forcem Nixpacks; mantenha `DATABASE_URL`, `PORT`, SMTP, etc.
5. `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (já vem no Dockerfile; não use `chromium-browser`)
6. Volume persistente: `/app/uploads` (PDFs dos caminhões)
7. **Redeploy** com “Clear build cache” / rebuild sem cache

Variáveis mínimas: `DATABASE_URL`, `PORT` (ex.: 3020), SMTP se for enviar e-mail.

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

## Endpoints de Analytics

- `GET /api/reports/overview`
- `GET /api/reports/cost-per-km?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&caminhaoId=1`

## Observações de Produção

- Defina `DB_SSL_MODE=require` para validar certificado.
- Evite `DB_SSL_MODE=no-verify` fora de cenário temporário.
- Ative `AUTH_ENABLED=true` e configure `API_TOKEN` em produção.
