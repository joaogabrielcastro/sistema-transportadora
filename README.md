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
- `PORT`: porta da API (default `3000`).
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
VITE_API_URL=http://localhost:3000
```

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
