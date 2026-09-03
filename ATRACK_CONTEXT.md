# ATRACK_CONTEXT.md

Levantamento do repositório **ATrack** (`sistema-transportadora`) para portar um
módulo fiscal (CT-e, MDF-e, CIOT) — hoje implementado no projeto **jwsoft** — para
dentro dele.

> **Escopo deste documento:** só leitura e documentação. Nada de fiscal foi
> implementado. Nenhuma migration criada. `schema.prisma` não foi tocado.

Data do levantamento: 2026-08-27
Branch: `main` · commit base `6734569`

---

## 0. Resumo executivo (o que responde as perguntas-chave)

| Pergunta | Resposta curta |
|---|---|
| "fiscal" é só um enum de plano ou já tem tabela/flag? | **Só string de plano.** `tenants.plan` é `VARCHAR(32)` livre (valores esperados `starter\|ops\|fiscal\|complete`). Não há enum no banco, não há tabela fiscal, não há flag booleana dedicada. A única coisa que o plano `fiscal` "liga" hoje é a feature `notas_estoque` (NF-e de **compra** + estoque), via o mapa `PLAN_FEATURES` em código. |
| Existe qualquer coisa de CT-e/MDF-e/CIOT/certificado no ATrack? | **Não.** Nenhum model, rota, serviço, permissão, feature-flag ou preço Stripe relacionado a emissão de documento fiscal de transporte. `notas_fiscais` no ATrack é **nota de compra de fornecedor** (entrada de estoque), não documento emitido. |
| Como o tenant é aplicado? | `tenant_id` (Int) sai do JWT → `req.context.user.tenantId` → `requireTenantId(req)` nos controllers → `where: { tenant_id }` manual em todo model/service. Sem RLS no Postgres. FKs cruzadas são revalidadas com `findFirst({ where: { id, tenant_id } })` (mesmo padrão do jwsoft). |
| Stack | Express 5 puro + Zod 4 + Prisma **7** + JavaScript (ESM, sem TS no runtime) + PostgreSQL. PKs `Int @default(autoincrement())`, colunas `snake_case`, models com nome plural minúsculo (`tenants`, `caminhoes`, `motoristas`). |
| RBAC | Papéis `admin` \| `operator` (há `viewer` no código, mas não exposto pra criação). Catálogo fixo de permissões em `utils/permissions.js` + extras por usuário em `users.permissions` (JSONB). |

---

## 1. `backend/prisma/schema.prisma` — inventário completo

Arquivo: [backend/prisma/schema.prisma](backend/prisma/schema.prisma) (406 linhas).

### Generator / datasource

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "library"          // Prisma 7, engine "library" (não edge/client)
}
datasource db {
  provider = "postgresql"
  // url vem via adapter em runtime (backend/src/lib/prisma.js), não do schema
}
```

`@prisma/client` **7.5**, `@prisma/adapter-pg` **7.5** — client instanciado com
`new PrismaClient({ adapter: new PrismaPg(new Pool({...})) })`. SSL resolvido em
código por `DB_SSL_MODE`.

### 1.1. `tenants` — a tabela multi-tenant + billing

```prisma
model tenants {
  id                      Int       @id @default(autoincrement())
  nome                    String    @db.VarChar(120)
  slug                    String    @unique @db.VarChar(64)
  ativo                   Boolean   @default(true)
  features                Json      @default("{}") @db.JsonB      // overrides de feature-flags
  billing_exempt          Boolean   @default(false)               // legado/parceiro: sem Stripe
  plan                    String?   @db.VarChar(32)               // "starter|ops|fiscal|complete" (texto livre)
  subscription_status     String?   @db.VarChar(32)               // "trialing|active|past_due|canceled|none"
  trial_ends_at           DateTime? @db.Timestamptz(6)
  stripe_customer_id      String?   @unique @db.VarChar(255)
  stripe_subscription_id  String?   @unique @db.VarChar(255)
  stripe_price_id         String?   @db.VarChar(255)
  onboarding_completed_at DateTime? @db.Timestamptz(6)
  alert_email             String?   @db.VarChar(255)
  whatsapp_notify_phone   String?   @db.VarChar(30)
  weekly_digest_enabled   Boolean   @default(true)
  last_weekly_digest_at   DateTime? @db.Timestamptz(6)
  criado_em               DateTime  @default(now()) @db.Timestamptz(6)

  // Relações (todas as tabelas de negócio penduram em tenants):
  users caminhoes gastos checklist pneus ordens_coleta_envio
  caminhao_documentos vinculos_composicao produtos notas_fiscais
  estoque_movimentos motoristas

  @@index([slug]) @@index([stripe_customer_id]) @@index([billing_exempt])
}
```

**Como o plano "fiscal" é modelado — resposta detalhada:**

- **Não existe enum de plano no Postgres.** `plan` é `VARCHAR(32)` NULL. A
  validação de valores válidos é 100% em código (`isValidPlan()` em
  [backend/src/utils/tenantFeatures.js](backend/src/utils/tenantFeatures.js)).
- **Não existe tabela nem coluna dedicada a "fiscal".** O que existe:
  - `PLANS = { starter, ops, fiscal, complete }` (objeto congelado em JS).
  - `PLAN_FEATURES` mapeia cada plano para um objeto de **duas** flags booleanas:
    ```js
    starter:  { ordem_coleta: false, notas_estoque: false }
    ops:      { ordem_coleta: true,  notas_estoque: false }
    fiscal:   { ordem_coleta: false, notas_estoque: true  }   // <-- "fiscal" == só notas/estoque
    complete: { ordem_coleta: true,  notas_estoque: true  }
    ```
  - `tenants.features` (JSONB) guarda **overrides** por tenant. O merge
    (`mergeFeatureOverrides`) **só reconhece as chaves `ordem_coleta` e
    `notas_estoque`** — qualquer outra chave no JSON é ignorada silenciosamente.
- **`notas_estoque` no ATrack = NF-e de compra + estoque.** Vide models
  `produtos`, `notas_fiscais`, `nota_itens`, `estoque_movimentos` abaixo. É
  entrada de mercadoria/insumo por XML de fornecedor, **não** emissão de
  documento fiscal de transporte. O nome do plano "fiscal" na UI
  ([frontend/src/utils/billing.js](frontend/src/utils/billing.js) `PLAN_CARDS`)
  descreve: *"importe NF-e e baixe produtos por veículo"*.
- **Stripe:** há `STRIPE_PRICE_FISCAL` (env) e o enum de checkout aceita
  `"fiscal"` — ver seção 6.

Fonte histórica: migrations
[20260728120000_multi_tenant](backend/prisma/migrations/20260728120000_multi_tenant/migration.sql)
(cria `tenants`, adiciona `tenant_id` NOT NULL + FK `ON DELETE RESTRICT` em
`users/caminhoes/gastos/checklist/pneus/ordens_coleta_envio/caminhao_documentos`,
troca `caminhoes.placa` unique global por `@@unique([tenant_id, placa])`) e
[20260806160000_tenant_billing_stripe](backend/prisma/migrations/20260806160000_tenant_billing_stripe/migration.sql)
(adiciona colunas Stripe; faz `UPDATE ... SET billing_exempt = true` em todos os
tenants pré-existentes sem Stripe — "grandfathering").

### 1.2. `users`

```prisma
model users {
  id            Int      @id @default(autoincrement())
  tenant_id     Int
  email         String   @unique @db.VarChar(255)   // <-- e-mail é ÚNICO GLOBAL (não por tenant)
  nome          String   @db.VarChar(120)
  password_hash String   @db.VarChar(255)           // bcryptjs
  role          String   @default("operator") @db.VarChar(32)   // "admin" | "operator" (texto livre)
  permissions   Json     @default("[]") @db.JsonB   // array de strings, permissões extras além do role
  ativo         Boolean  @default(true)
  criado_em     DateTime @default(now()) @db.Timestamptz(6)
  tenants       tenants  @relation(fields: [tenant_id], references: [id], onDelete: Restrict)
  @@index([role]) @@index([tenant_id])
}
```

O login é por **e-mail + senha**; o tenant é derivado do usuário (não há
seleção de tenant no login). `email @unique` global implica: um e-mail nunca
pode existir em dois tenants.

### 1.3. `caminhoes` (a "frota") — TODOS os campos

```prisma
model caminhoes {
  id                Int       @id @default(autoincrement())
  tenant_id         Int
  placa             String    @db.VarChar(10)
  qtd_pneus         Int                                  // obrigatório
  km_atual          Int?      @default(0)
  criado_em         DateTime? @default(now()) @db.Timestamptz(6)
  numero_carreta_1  Int?
  numero_cavalo     Int?
  motorista         String?   @db.VarChar(100)           // nome do motorista em TEXTO (denormalizado)
  motorista_id      Int?                                 // FK opcional -> motoristas.id
  numero_carreta_2  Int?
  placa_carreta_1   String?   @db.VarChar(10)
  placa_carreta_2   String?   @db.VarChar(10)
  ano               Int?
  marca             String?   @db.VarChar(100)
  modelo            String?   @db.VarChar(100)
  tipo_veiculo      String    @default("truck") @db.VarChar(20)   // "truck" | "cavalo" | "carreta"
  config_eixos      String?   @db.VarChar(32)            // ex: "6x2", "6x4", "8x2", "8x4"
  com_4_eixo        Boolean   @default(false)
  chassi            String?   @db.VarChar(40)
  empresa           String?   @db.VarChar(80)            // texto livre: "Solofino | Colombocal | Transmotin"
  // relações: tenants, motorista_ref (motoristas?), checklist[], gastos[], pneus[],
  //           ordens_coleta_envio[], caminhao_documentos[], vinculos_como_cavalo[],
  //           vinculos_como_carreta[], estoque_movimentos[], notas_fiscais[]
  @@unique([tenant_id, placa])
  @@index([tenant_id]) @@index([tenant_id, tipo_veiculo]) @@index([motorista_id])
}
```

- `placa` **não** é unique global — é `@@unique([tenant_id, placa])`. Dois
  tenants podem ter a mesma placa (testado em
  [tests/integration/tenantIsolation.integration.test.js](backend/tests/integration/tenantIsolation.integration.test.js)).
- `motorista` (texto) e `motorista_id` (FK) coexistem: o serviço sincroniza o
  texto a partir do nome do motorista vinculado (`applyMotoristaLink`).
- FK `motorista_id` → `motoristas` com `onDelete: SetNull`.
- Comentário no schema: *"This table contains check constraints and requires
  additional setup for migrations."* (constraints CHECK feitas fora do
  `prisma migrate`).

### 1.4. `motoristas` — TODOS os campos

```prisma
model motoristas {
  id            Int       @id @default(autoincrement())
  tenant_id     Int
  nome          String    @db.VarChar(120)
  cpf           String?   @db.VarChar(14)
  cnh           String?   @db.VarChar(30)
  cnh_categoria String?   @db.VarChar(8)
  cnh_validade  DateTime? @db.Date
  telefone      String?   @db.VarChar(30)
  whatsapp      String?   @db.VarChar(30)
  ativo         Boolean   @default(true)
  observacao    String?                        // sem @db.VarChar -> TEXT
  criado_em     DateTime  @default(now()) @db.Timestamptz(6)
  tenants       tenants     @relation(fields: [tenant_id], references: [id], onDelete: Restrict)
  caminhoes     caminhoes[]                    // motoristas.id <- caminhoes.motorista_id
  @@index([tenant_id]) @@index([tenant_id, ativo]) @@index([cnh_validade])
}
```

- **Não há** `@@unique` em `cpf` nem `cnh` (nem global nem por tenant). CPF pode
  repetir.
- **Não há** `updatedAt` / `atualizado_em`.
- `observacao` é TEXT (sem limite declarado).

### 1.5. Demais models (resumo — relevantes para entender o domínio)

| Model | Papel | Campos-chave | tenant_id |
|---|---|---|---|
| `vinculos_composicao` | Histórico cavalo↔carreta | `cavalo_id`, `carreta_id`, `ordem`, `ativo`, `inicio_em`, `fim_em` | sim |
| `caminhao_documentos` | PDFs por caminhão | `caminhao_id`, `arquivo_path`, `tipo_documento`, `validade_em` | sim |
| `audit_logs` | Auditoria de mutações | `user_id`, `action`, `method`, `path`, `entity`, `entity_id`, `summary` (Json) | `tenant_id Int?` (nullable) |
| `ordens_coleta_envio` | Fila de envio de ordem de coleta (PDF+e-mail) | `tipo`, `caminhao_id?`, `dados` (Json), `email_destinatario`, `enviado_em`, `erro_envio`, `retry_count` | sim |
| `checklist` | Manutenção | `caminhao_id?`, `item_id?`, `produto_id?`, `data_manutencao`, `valor` (Decimal 10,2), `proxima_km`, `proxima_data` | sim |
| `gastos` | Gastos/custos | `caminhao_id?`, `tipo_gasto_id?`, `produto_id?`, `valor` (Decimal 10,2), `data_gasto`, `quantidade_combustivel` | sim |
| `itens_checklist` | Lookup global de itens de checklist | `nome_item @unique` | **não** (tabela de referência global) |
| `pneus` | Controle de pneus | `caminhao_id?`, `posicao_id?`, `status_id?`, `vida_util_km`, `marca`, `modelo` | sim |
| `posicoes_pneus`, `status_pneus`, `tipos_gastos` | Lookups globais | `nome_* @unique` | **não** (referência global) |
| `produtos` | Cadastro de produto/insumo (estoque) | `codigo?`, `descricao`, `unidade`, `ncm?`, `saldo` (Decimal 14,3), `preco_custo` (Decimal 14,4), `atualizado_em @updatedAt` | sim |
| `notas_fiscais` | **NF-e de COMPRA de fornecedor** (entrada de estoque) | `chave_acesso? VarChar(44)`, `numero`, `serie?`, `emitente?`, `cnpj_emitente?`, `data_emissao`, `valor_total/desconto/frete/ipi` (Decimal 14,2), `pdf_path?`, `xml_path?`, `status` (default "confirmada"), `origem` (default "xml"), `data_vencimento?`, `condicao_pagamento?`, `caminhao_id?` | sim |
| `nota_itens` | Itens da NF de compra | `nota_id`, `produto_id?`, `codigo`, `descricao`, `quantidade` (Decimal 14,3), `valor_unitario` (Decimal 14,4), `valor_ipi` | via `nota_id` (não tem coluna própria) |
| `estoque_movimentos` | Kardex (entrada/baixa) | `produto_id`, `tipo` ("entrada"/"baixa"), `quantidade`, `nota_id?`, `caminhao_id?`, `motivo` | sim |

Padrões notáveis do schema:
- **Nenhum enum Prisma** — sempre `String` + comentário `///` listando valores.
- IDs sempre `Int @default(autoincrement())` (exceto `audit_logs.id` que é `BigInt`).
- Colunas `snake_case`; timestamps `@db.Timestamptz(6)`; datas puras `@db.Date`.
- `onDelete: Restrict` em quase todas as FKs de `tenant_id`; `SetNull` /
  `Cascade` nas FKs de negócio.
- Tabelas de lookup verdadeiramente globais (sem tenant): `itens_checklist`,
  `posicoes_pneus`, `status_pneus`, `tipos_gastos`.

### 1.6. Migrations existentes (ordem cronológica)

```
20260319_add_indexes_and_precision
20260511120000_ordens_coleta_envio
20260518120000_caminhao_documentos
20260706180000_users_and_ordem_retries
20260728120000_multi_tenant                 <-- introduz tenants + tenant_id + FKs
20260806150000_frota_tipos_notas_estoque
20260806160000_tenant_billing_stripe        <-- colunas Stripe/plan/subscription
20260806180000_motoristas_audit_alerts      <-- cria motoristas, audit_logs
20260806190000_checklist_proxima_manutencao
20260811120000_nota_caminhao_gasto_produto
20260814120000_produto_preco_estoque_caminhao
20260818120000_nota_cadastro_manual
20260827120000_nota_ipi_desconto_frete
```

Migrations são **SQL cru** com guardas (`IF NOT EXISTS`, `DO $$ ... EXCEPTION
WHEN duplicate_object`). O deploy usa um script próprio,
`scripts/baseline-and-deploy.mjs` (`npm run db:migrate` / roda no `prestart`),
que baseliza migrações antigas e aplica só o que falta (contorna P3005 em bancos
pré-existentes).

---

## 2. Como `tenant_id` é aplicado hoje

### 2.1. Extração do tenant a partir do JWT

- Token: **JWT HS256** assinado com `JWT_SECRET` (fallback `API_TOKEN`),
  `expiresIn` `JWT_EXPIRES_IN` (default **7d**). Lib: `jsonwebtoken`.
  Ver [backend/src/utils/jwt.js](backend/src/utils/jwt.js).
- Payload gerado no login/register (`AuthService.buildAuthPayload`):
  ```js
  { sub: String(user.id), email, role, nome, tenantId /* Number */, permissions /* string[] */ }
  ```
- Middleware `requireAuth` em
  [backend/src/middleware/security.js](backend/src/middleware/security.js):
  1. Lê `Authorization: Bearer <token>`.
  2. `verifyAccessToken(token)` → se tem `sub`, chama `applyJwtUser(req, payload)`.
  3. `applyJwtUser` **valida `tenantId`**: `Number.isInteger(tenantId) && tenantId > 0`,
     senão retorna **401 `"Token sem tenant. Faça login novamente."`**.
  4. Popula `req.context.user = { id, role, email, nome, tenantId, permissions: resolvePermissions(role, payload.permissions) }`.
- `AUTH_ENABLED=false` (dev): se vier JWT, respeita o `tenantId` dele; senão usa
  `DEFAULT_TENANT_ID` (env) ou o tenant seed `abbroto` (`resolveDefaultTenantId`),
  com `role: "admin"` e todas as permissões.
- `API_TOKEN` estático (scripts/CI): vira `role admin` no `DEFAULT_TENANT_ID`.

### 2.2. Uso do tenant nos controllers/services

- Controllers chamam `requireTenantId(req)` de
  [backend/src/utils/tenant.js](backend/src/utils/tenant.js):
  ```js
  export function requireTenantId(req) {
    const tenantId = Number(req?.context?.user?.tenantId);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      const err = new Error("Tenant não identificado"); err.statusCode = 401; throw err;
    }
    return tenantId;
  }
  ```
- **`tenant_id` NUNCA vem do body.** É sempre injetado a partir do JWT no
  controller e passado como primeiro argumento pro service/model.
- Models usam um helper `withTenant(tenantId, where)` que espalha
  `tenant_id: Number(tenantId)` em todo `where` do Prisma
  (ex.: [backend/src/models/caminhoesModel.js](backend/src/models/caminhoesModel.js)).
  Toda leitura/escrita/contagem/`$transaction` carrega `tenant_id`.

### 2.3. Validação cruzada de tenant em FKs (o "mesmo padrão do jwsoft")

Sim, o ATrack faz a revalidação de que um id de FK pertence ao mesmo tenant
antes de usá-lo — o mesmo princípio da regra registrada no jwsoft ("referência
cruzada a outra tabela com tenantId precisa confirmar que pertence ao MESMO
tenant"). Exemplos concretos:

- **`CaminhaoService.applyMotoristaLink`**
  ([backend/src/services/CaminhaoService.js](backend/src/services/CaminhaoService.js)):
  antes de gravar `caminhoes.motorista_id`, faz
  `prisma.motoristas.findFirst({ where: { id, tenant_id: Number(tenantId) } })`
  e lança 400 `"Motorista não encontrado neste tenant"` se não achar.
- **`NotaFiscalService.resolveCaminhaoId`**
  ([backend/src/services/NotaFiscalService.js](backend/src/services/NotaFiscalService.js)):
  só aceita `caminhao_id` se `tx.caminhoes.findFirst({ where: withTenant(tenantId, { id }) })`
  retornar. Dedup de NF também escopado por tenant.
- **`UserService`**: `findFirst({ where: { id, tenant_id } })` antes de qualquer
  update/deactivate; regras de "pelo menos 1 admin ativo" contam por tenant.
- **`ComposicaoService`** (vínculo cavalo↔carreta): valida os dois veículos no
  tenant.

Isso é feito **em código** (defense-in-depth na camada de aplicação). **Não há
Row-Level Security no Postgres** — se um `where: { tenant_id }` for esquecido em
um query novo, há vazamento. A suíte
[tests/integration/tenantIsolation.integration.test.js](backend/tests/integration/tenantIsolation.integration.test.js)
cobre: JWT sem tenant → 401; tenant A não lista/abre/edita/apaga recurso do
tenant B (caminhão, gasto, checklist); mesma placa em tenants diferentes é OK;
e-mail único global.

---

## 3. Estrutura de pastas do `backend/` (Express puro, camadas)

```
backend/
├── server.js                     # bootstrap: sobe HTTP, workers, ensureBootstrapAdmin
├── prisma.config.ts              # config do Prisma CLI (TS)
├── prisma/
│   ├── schema.prisma
│   └── migrations/**/migration.sql
├── scripts/                      # CLIs operacionais (.mjs)
│   ├── create-tenant.mjs         #  npm run tenant:create
│   ├── set-tenant-billing.mjs    #  npm run tenant:billing
│   ├── baseline-and-deploy.mjs   #  npm run db:migrate  (deploy custom)
│   ├── worker-ordem-coleta.mjs   #  worker BullMQ separado (opcional)
│   ├── run-weekly-digest.mjs
│   └── ...
└── src/
    ├── app.js                    # monta o Express: helmet, cors, rate limit,
    │                             #   raw webhook, express.json, apiRouter, errorHandler
    ├── config/
    │   ├── index.js              # `config` central (getters lêem process.env)
    │   └── validateProduction.js
    ├── lib/
    │   ├── prisma.js             # PrismaClient singleton + adapter-pg + SSL
    │   └── redis.js
    ├── middleware/
    │   ├── security.js           # requireAuth, requireRole, requireApiToken,
    │   │                         #   attachRequestContext, auditLog, rate limiters
    │   ├── requirePermission.js  # RBAC granular
    │   ├── requireFeature.js     # feature-flag por tenant (ordem_coleta|notas_estoque)
    │   ├── requireActiveSubscription.js  # 402 se billing sem acesso
    │   ├── uploadCaminhaoPdf.js  # multer
    │   └── errorHandler.js       # errorHandler + notFound (mapeia Zod, Prisma, statusCode)
    ├── routes/         *Routes.js  — só declaram verbo+path+middleware+handler
    ├── controllers/    *Controller.js — parse do req (Zod), chama service, formata resposta
    ├── services/       *Service.js — regra de negócio, orquestra Prisma / outros services
    ├── models/         *Model.js  — acesso a dados Prisma cru p/ alguns domínios
    │                               (caminhoes, gastos, checklist, pneus, ...); outros
    │                               domínios (motoristas, notas, users) falam Prisma
    │                               direto do Service, sem camada model.
    ├── schemas/        *Schema.js — schemas Zod de validação de entrada
    ├── queues/         ordemColetaJobQueue.js — BullMQ (Redis) ou fila em memória
    ├── templates/      HTML/JS de ordem de coleta (PDF via puppeteer)
    ├── utils/          jwt, tenant, tenantFeatures, permissions, password (bcrypt),
    │                   dates, placa, prismaSerialization, parseNfeXml, healthCheck, ...
    └── types/api.ts    (tipos TS opcionais, não usados no runtime JS)
```

**Fluxo de uma request** (`app.js`):

```
helmet
 → attachRequestContext            (req.context = { requestId, user:{id:'anonymous'} })
 → cors (allowlist CSV normalizada)
 → POST /api/billing/webhook       (express.raw — ANTES do json parser)
 → express.json({limit:'10mb'}) / urlencoded
 → logger
 → GET / , GET /health
 → PATCH /api/billing/admin/tenants/:id   (requireApiToken — fora do apiRouter)
 → apiRouter (/api):
     apiRateLimiter
     POST /auth/login , POST /auth/register   (authRateLimiter, SEM requireAuth)
     requireAuth                              (a partir daqui exige JWT)
     auditLog                                 (grava audit_logs em POST/PUT/PATCH/DELETE)
     GET /auth/me
     /billing                                 (acessível SEM assinatura ativa)
     requireActiveSubscription                (402 SUBSCRIPTION_REQUIRED se sem acesso)
     /caminhoes /pneus /posicoes-pneus /status-pneus /gastos /checklist
     /itens-checklist /tipos-gastos /reports /registros /users /motoristas
     /ops /notas-fiscais
     /ordem-coleta   → requireFeature('ordem_coleta') + regra extra p/ DELETE histórico
 → notFound → errorHandler
```

Cada `*Routes.js` aplica `requirePermission(PERMISSIONS.X)` por rota. Ex.:
[caminhoesRoutes.js](backend/src/routes/caminhoesRoutes.js),
[motoristasRoutes.js](backend/src/routes/motoristasRoutes.js),
[usersRoutes.js](backend/src/routes/usersRoutes.js) (`router.use(requireRole("admin"))`),
[notasFiscaisRoutes.js](backend/src/routes/notasFiscaisRoutes.js)
(`router.use(requireFeature("notas_estoque"))` + `requirePermission(NOTAS_*)`).

**Formato de resposta padrão:** `{ success: boolean, data?, message?, error?, code?, details? }`.
Erros centralizados no `errorHandler` — reconhece `ZodError` (400
`VALIDATION_ERROR`), `Prisma.PrismaClientKnownRequestError` (P2002→400,
P2003→400, P2025→404), e `err.statusCode` (400/401/403/404/409/503).

---

## 4. Campos reais de `Caminhao` e `Motorista` (fonte: schema + Zod + models)

### 4.1. `caminhoes` — schema Zod de entrada

[backend/src/schemas/caminhaoSchema.js](backend/src/schemas/caminhaoSchema.js):

| Campo | Tipo Zod | Notas |
|---|---|---|
| `placa` | `string().min(7)` | normalizada por `utils/placa.js` |
| `qtd_pneus` | `number().int().positive()` | **obrigatório** |
| `km_atual` | `number().nonnegative().nullable().optional()` | update passa por `KmCaminhaoService.setKmManual` |
| `motorista` | `string().nullable().optional()` | texto; sincronizado do `motorista_id` |
| `motorista_id` | preprocess → `number().int().positive().nullable().optional()` | revalidado no tenant |
| `marca`, `modelo` | `string().nullable().optional()` | |
| `ano` | `number().int().min(1900).max(ano+1).nullable().optional()` | |
| `numero_carreta_1`, `numero_carreta_2`, `numero_cavalo` | `number().int().nonnegative().nullable().optional()` | `""`/NaN → null |
| `placa_carreta_1`, `placa_carreta_2` | `string().nullable().optional()` | |
| `tipo_veiculo` | `enum(["truck","cavalo","carreta"]).default("truck")` | |
| `config_eixos` | `string().max(32).nullable().optional()` | |
| `com_4_eixo` | `boolean().optional()` | |
| `chassi` | `string().max(40).nullable().optional()` | |
| `empresa` | `string().max(80).nullable().optional()` | texto livre |

`caminhaoUpdateSchema = caminhaoSchema.partial()`. Model allow-list de escrita em
`caminhoesModel.normalizeCaminhaoData` bate 1:1 com as colunas acima + `km_atual`.
Unicidade adicional de negócio (não é constraint DB): `validateUniqueness`
impede reuso de nº/placa de carreta e nº de cavalo entre caminhões do mesmo
tenant.

### 4.2. `motoristas` — schema Zod de entrada

[backend/src/services/MotoristaService.js](backend/src/services/MotoristaService.js)
(schema Zod inline, não em `schemas/`):

| Campo | Tipo Zod | Coluna |
|---|---|---|
| `nome` | `string().trim().min(2).max(120)` | `nome VarChar(120)` |
| `cpf` | `string().trim().max(14).optional().nullable()` | `cpf VarChar(14)` |
| `cnh` | `string().trim().max(30).optional().nullable()` | `cnh VarChar(30)` |
| `cnh_categoria` | `string().trim().max(8).optional().nullable()` | `cnh_categoria VarChar(8)` |
| `cnh_validade` | `string().optional().nullable()` → `parseDate()` | `cnh_validade Date` |
| `telefone` | `string().trim().max(30).optional().nullable()` | `telefone VarChar(30)` |
| `whatsapp` | `string().trim().max(30).optional().nullable()` | `whatsapp VarChar(30)` |
| `ativo` | `boolean().optional()` (default `true`) | `ativo` |
| `observacao` | `string().optional().nullable()` | `observacao` TEXT |

`list()` aceita `q` (busca em nome/cpf/cnh, mín. 2 chars) e `ativo`. `remove()`
faz `caminhoes.updateMany({ motorista_id: null })` antes de deletar.

---

## 5. Autenticação / RBAC

### 5.1. Autenticação

- **Login:** `POST /api/auth/login` (`{ email, password }`) — `authRateLimiter`
  (15 min, 40 tentativas). `AuthService.login`: normaliza e-mail, `findUnique`
  por e-mail com `include tenants`, checa `user.ativo` e `tenants.ativo`,
  `verifyPassword` (bcryptjs), devolve `{ token, user }`.
- **Register público:** `POST /api/auth/register`
  (`{ empresaNome, email, password, nome? }`) — cria `tenants` + `users` admin
  numa transação; novo tenant entra em **trial de 14 dias no plano `ops`**
  (`newTenantBillingDefaults`). Desligável com `ALLOW_PUBLIC_REGISTER=false`.
- **Bootstrap:** `ensureBootstrapAdmin` cria o admin do tenant seed `abbroto` a
  partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` se o tenant não tiver usuários.
- **`GET /api/auth/me`** devolve o perfil + bloco de billing/features.
- `AUTH_ENABLED` (default `false`!) controla se o JWT é exigido. Em produção
  **tem que** ser `true` + `JWT_SECRET` ≥ 16 chars (validado em
  `config/validateProduction.js`).

### 5.2. RBAC — papéis e permissões

Fonte: [backend/src/utils/permissions.js](backend/src/utils/permissions.js).

- **Papéis:** `admin`, `operator`. Há um terceiro, `viewer`, presente em
  `ROLE_PERMISSIONS`, em `userSchema` (`ROLES = ["admin","operator","viewer"]`) e
  como default de `requireRole`/`applyJwtUser`, **mas o README só documenta
  `admin|operator`** e `UserService.create/update` força
  `role === "admin" ? "admin" : "operator"` (nunca grava `viewer`). Tratar
  `viewer` como "existe no código, não exposto".
- **Catálogo fixo de permissões** (`PERMISSIONS`):
  `frota.read/write`, `gastos.write`, `pneus.write`, `docs.read/write`,
  `motoristas.read/write`, `ordem.send`, `notas.read/write`, `reports.read`,
  `users.manage`, `billing.manage`, `audit.read`, `alerts.read`,
  `settings.write`.
- `ROLE_PERMISSIONS`: `admin` = **todas**; `operator` = subconjunto
  (frota/gastos/pneus/docs/motoristas/ordem.send/notas/reports/alerts); `viewer`
  = só `*.read`.
- `resolvePermissions(role, extras)` = permissões do role **∪**
  `users.permissions` (array JSONB de strings por usuário). Guardado no JWT.
- **Enforcement:**
  - `requirePermission(...perms)` — 403 `{ error, required }` se faltar alguma
    (`hasPermission` exige **todas** as listadas).
  - `requireRole(...roles)` — 403 se o role não estiver na lista (ex.:
    `usersRoutes` inteira exige `admin`; `billingRoutes` checkout/portal exigem
    `admin`).
  - `requireFeature(key)` — 403 `"Módulo não disponível para esta empresa"` se a
    feature-flag do tenant estiver desligada.
  - `requireActiveSubscription` — 402 `SUBSCRIPTION_REQUIRED` se billing sem
    acesso (aplicado globalmente após `/billing`).

### 5.3. Como um módulo novo se autentica/autoriza aqui

Para um módulo fiscal seguir o padrão do ATrack:

1. **Rota** montada em `app.js` **depois** de `apiRouter.use(requireAuth)` e
   (provavelmente) depois de `requireActiveSubscription` — ex.:
   `apiRouter.use("/fiscal", requireFeature("fiscal_transporte"), fiscalRoutes)`.
2. **Novas permissões** adicionadas a `PERMISSIONS` (ex.: `CTE_READ`,
   `CTE_WRITE`, `MDFE_WRITE`, `CIOT_WRITE`), incluídas em `ROLE_PERMISSIONS.admin`
   e (a critério) em `operator`. Cada rota usa
   `requirePermission(PERMISSIONS.CTE_WRITE)`.
3. **tenant_id**: controller chama `requireTenantId(req)` e passa como 1º arg;
   nunca ler do body. FK cruzada (motorista/veículo/cliente) revalidada com
   `findFirst({ where: { id, tenant_id } })`.
4. **Validação** com Zod em `src/schemas/` (não class-validator).
5. **Feature-flag**: hoje `requireFeature` e o merge de `features` só conhecem
   `ordem_coleta`/`notas_estoque` — habilitar uma feature fiscal exige tocar
   `tenantFeatures.js` (ver seção 7 e Gaps).

---

## 6. Billing Stripe ligado ao plano "fiscal"

Fontes: [backend/src/config/index.js](backend/src/config/index.js),
[backend/src/services/BillingService.js](backend/src/services/BillingService.js),
[backend/src/controllers/billingController.js](backend/src/controllers/billingController.js),
[backend/src/routes/billingRoutes.js](backend/src/routes/billingRoutes.js).

- **Preço:** `config.billing.prices.fiscal` ← env **`STRIPE_PRICE_FISCAL`**
  (junto de `STRIPE_PRICE_STARTER/OPS/COMPLETE`). É a única "config fiscal"
  existente e é puramente de cobrança.
- **Checkout:** `POST /api/billing/checkout-session` (`requireRole("admin")`),
  body `{ plan }` validado por `z.enum([starter, ops, fiscal, complete])`.
  `BillingService.createCheckoutSession` resolve `priceIdForPlan("fiscal")`,
  garante `stripe_customer_id`, cria sessão Stripe `mode: "subscription"` com
  `metadata.plan = "fiscal"`.
- **Portal:** `POST /api/billing/portal-session` (`requireRole("admin")`).
- **Status:** `GET /api/billing/status` → `buildBillingPublic(tenant)` +
  lista de planos com `priceConfigured` + `stripeConfigured`.
- **Webhook:** `POST /api/billing/webhook` (raw body, fora do `apiRouter`).
  Eventos tratados: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.payment_failed`.
  `applySubscription` deriva o plano por `planForPriceId(priceId)` (casa o
  `price.id` com `STRIPE_PRICE_*`) ou por `subscription.metadata.plan`, e grava
  em `tenants`: `plan`, `subscription_status` (mapeado de Stripe),
  `stripe_*_id`, `trial_ends_at`, **e `features = featuresForPlan(plan)`**
  (sobrescreve as flags). Ou seja: assinar o plano `fiscal` no Stripe seta
  `tenants.features = { ordem_coleta: false, notas_estoque: true }`.
- **Admin/CLI:** `PATCH /api/billing/admin/tenants/:id` (`requireApiToken`) e
  `npm run tenant:billing -- --slug=x --exempt=false --plan=fiscal`
  (`BillingService.adminUpdateTenantBilling`). `isValidPlan("fiscal")` é `true`.
- **Bypass:** `billing_exempt = true` → `hasActiveSubscriptionAccess` retorna
  `true` sempre, e as features vêm de `defaultFeaturesForSlug(slug)` (legado),
  não do plano. O tenant seed `abbroto` e o `trans-motin` são isentos.
- **Nenhuma lógica Stripe específica de "fiscal"** além do price id e do
  aparecer no enum. Não há trial diferente, nem gating de rota por plano
  `=== "fiscal"` (o gating é sempre por **feature-flag**, não por nome de plano).

Frontend: [frontend/src/utils/billing.js](frontend/src/utils/billing.js)
(`PLAN_CARDS`, `featureEnabled`, `hasBillingAccess` — espelham o backend),
[frontend/src/components/FeatureRoute.jsx](frontend/src/components/FeatureRoute.jsx)
(bloqueia rota SPA por feature, só conhece `ordem_coleta`/`notas_estoque`),
`BillingGate.jsx`, `Assinatura.jsx`.

---

## 7. Como as feature-flags funcionam (detalhe para o módulo fiscal)

[backend/src/utils/tenantFeatures.js](backend/src/utils/tenantFeatures.js):

- `resolveTenantFeatures({ raw, slug, billingExempt, plan })`:
  - se `billingExempt` → base = `defaultFeaturesForSlug(slug)` (mapa legado por
    slug), senão base = `featuresForPlan(plan)`.
  - aplica `mergeFeatureOverrides(base, raw)` onde `raw = tenants.features` (JSON).
- **`mergeFeatureOverrides` tem as chaves hard-coded:**
  ```js
  return {
    ordem_coleta:  typeof raw.ordem_coleta  === "boolean" ? raw.ordem_coleta  : base.ordem_coleta,
    notas_estoque: typeof raw.notas_estoque === "boolean" ? raw.notas_estoque : base.notas_estoque,
  };
  ```
  Qualquer chave nova em `tenants.features` (ex.: `cte`, `mdfe`,
  `fiscal_transporte`) é **descartada**. Para uma feature fiscal existir, é
  obrigatório editar essa função (e `PLAN_FEATURES`, `DEFAULT_TENANT_FEATURES`,
  `requireFeature` typedef, `FEATURE_LABELS` no front).

---

## 8. Gaps para integração fiscal

Tudo abaixo exige **decisão do usuário** antes de portar código do jwsoft.

### 8.1. Diferenças de stack

| Aspecto | jwsoft (origem do módulo fiscal) | ATrack (destino) | Impacto |
|---|---|---|---|
| Framework HTTP | **Nest.js** (módulos, DI, decorators, guards) | **Express 5 puro** (router + middleware functions) | Todo controller/service Nest precisa virar `routes + controller + service` no estilo ATrack. `@UseGuards(JwtAuthGuard)` → posição no `apiRouter`. `@CurrentUser()` → `req.context.user` / `requireTenantId(req)`. `@Injectable()`/construtor DI → `import` de singletons (`prisma` de `lib/prisma.js`). |
| Linguagem | **TypeScript** compilado (`dist/`) | **JavaScript ESM** rodando direto (`type: module`); TS só p/ `tsc --noEmit` opcional | Reescrever `.ts` → `.js` (ou introduzir build TS no backend — decisão de arquitetura). Tipos das interfaces/DTO viram JSDoc ou somem. |
| Validação | **class-validator + class-transformer** DTOs (`@IsString()`, `@IsNotEmpty()`, `!`) + `@nestjs/swagger` | **Zod 4** (`z.object(...).parse(req.body)` no controller) | Cada DTO (`EmitirCteDto`, `CancelarCteDto`, `EmitirMdfeDto`, DTOs CIOT com estruturas aninhadas) precisa ser reescrito como schema Zod em `src/schemas/`. Sem Swagger no ATrack. |
| ORM | **Prisma 6** (fixado de propósito) | **Prisma 7** + `@prisma/adapter-pg` + engine `library` | Versões diferentes de client/engine. Ao mover models, gerar client 7. Sintaxe de schema é compatível, mas o ATrack **não usa `enum` Prisma** e resolve `url` via adapter, não via `env()` no schema. |
| PK / ids | `String @id @default(uuid())` em todos os models | `Int @id @default(autoincrement())` (só `audit_logs` é `BigInt`) | **Maior incompatibilidade estrutural.** Ver 8.3. |
| Nomenclatura | Models PascalCase singular (`Veiculo`, `Motorista`, `ConhecimentoTransporte`); campos `camelCase` (`tenantId`, `placaCarreta1`) | Models plural minúsculo (`caminhoes`, `motoristas`); colunas `snake_case` (`tenant_id`, `placa_carreta_1`) | Renomear tudo ao portar os models fiscais; FKs para frota mudam de `veiculoId` → `caminhao_id`. |
| Enums | `enum StatusDocumentoFiscal { PENDENTE ... }`, `StatusCiot`, `StatusViagem` no schema | Convenção: **sem enum**, `String` + comentário `///` com valores | Decidir: manter enums Prisma (quebra a convenção do ATrack) ou converter para `String` + validação Zod. |
| Auth guard | `JwtAuthGuard` (passport-jwt) + `RolesGuard` (`USER`/`ADMIN`) | `requireAuth` (jsonwebtoken puro) + `requireRole` + `requirePermission` (catálogo granular) | Payload JWT diferente (ver 8.4). RBAC do jwsoft é binário; o do ATrack é granular — criar permissões `CTE_*`, `MDFE_*`, `CIOT_*`. |
| Validação de subscription | jwsoft não tem gating de assinatura por rota | `requireActiveSubscription` global (402) + `requireFeature` | Rotas fiscais herdam o 402; decidir a feature-flag (8.2). |
| tenantId no JWT | `string` (uuid) | `number` (Int) | `applyJwtUser` valida `Number.isInteger`. Payloads/serviços fiscais assumem string. |
| Testes | Jest (`*.spec.ts`), 123 testes | `node:test` + `supertest` (`*.test.js`) | Reescrever specs. |
| XML fiscal | `xmlContent String? @db.Text` inline na linha do documento | `notas_fiscais` guarda `xml_path`/`pdf_path` (arquivo em disco/S3, `ObjectStorage`) | Decidir: XML de CT-e/MDF-e em coluna `@db.Text` (contraria o padrão de arquivos do ATrack, mas é o padrão do jwsoft e "XML é exceção") ou em object storage como as NFs de compra. |
| Migrations | `prisma migrate dev` normal | SQL cru com guardas + `scripts/baseline-and-deploy.mjs` | **Usuário pediu para NÃO criar migration agora.** Quando for a hora, seguir o estilo do ATrack (SQL idempotente). |
| Provedor externo | `BrasilNfeClientService` (HTTP), env de token, certificado A1 obrigatório | ATrack não tem cliente HTTP externo p/ fiscal; tem `WhatsAppService` e SMTP como referência de "serviço externo" | Portar o client como um `service` novo; segredos via `config/index.js` (getters de `process.env`). |

### 8.2. Colisão semântica do plano/feature "fiscal"

- No ATrack, **"fiscal" já significa "NF-e de compra + estoque"** (feature
  `notas_estoque`): plano Stripe `STRIPE_PRICE_FISCAL`, card "Fiscal" na UI
  (*"importe NF-e e baixe produtos por veículo"*), rota `/api/notas-fiscais`
  atrás de `requireFeature("notas_estoque")`.
- O módulo do jwsoft é **emissão de documento fiscal de transporte** (CT-e /
  MDF-e / CIOT) — coisa diferente.
- **Decisões necessárias:**
  1. O módulo de transporte entra no plano `fiscal` existente, vira um plano
     novo (`fiscal_transporte` / `transporte`), ou vira add-on do `complete`?
  2. Nova feature-flag (`fiscal_transporte`? `cte`? `mdfe`? `ciot`
     separadas?) — e é obrigatório estender `mergeFeatureOverrides` +
     `PLAN_FEATURES` + `requireFeature` + `FEATURE_LABELS` do front, que hoje
     têm as 2 chaves hard-coded.
  3. Novo `STRIPE_PRICE_*` e entrada no enum de checkout + `planForPriceId`.
  4. Renomear o card/label "Fiscal" atual para evitar confusão do usuário final?

### 8.3. `Caminhao` (ATrack) × `Veiculo` (jwsoft) — mapa de campos

O jwsoft já alinhou o `Veiculo` para espelhar o `caminhoes` do ATrack (migration
`20260826150000_alinhar_schema_com_sistema_socio`), então os **campos batem quase
1:1** — a diferença é de forma, não de conteúdo:

| jwsoft `Veiculo` | ATrack `caminhoes` | Diferença |
|---|---|---|
| `id String @id @default(uuid())` | `id Int @id @default(autoincrement())` | **tipo de PK** |
| `tenantId String` | `tenant_id Int` | nome + tipo |
| `placa String` | `placa String @db.VarChar(10)` | `@@unique([tenantId, placa])` em ambos ✅ |
| `tipoVeiculo String @default("truck")` | `tipo_veiculo String @default("truck") @db.VarChar(20)` | nome (camel vs snake) |
| `qtdPneus Int` | `qtd_pneus Int` | nome |
| `kmAtual Int? @default(0)` | `km_atual Int? @default(0)` | nome |
| `numeroCavalo Int?` | `numero_cavalo Int?` | nome |
| `numeroCarreta1 Int?` / `numeroCarreta2 Int?` | `numero_carreta_1` / `numero_carreta_2` | nome |
| `placaCarreta1 String?` / `placaCarreta2 String?` | `placa_carreta_1` / `placa_carreta_2` | nome |
| `ano Int?` | `ano Int?` | — |
| `marca String?` / `modelo String?` | idem | — |
| `configEixos String?` | `config_eixos String? @db.VarChar(32)` | nome |
| `com4Eixo Boolean @default(false)` | `com_4_eixo Boolean @default(false)` | nome |
| `chassi String?` | `chassi String? @db.VarChar(40)` | nome |
| `empresa String?` | `empresa String? @db.VarChar(80)` | nome |
| `motoristaId String?` (+ relation, **sem validação de tenant — pendência conhecida**) | `motorista_id Int?` (+ `motorista_ref`, **COM validação de tenant** via `applyMotoristaLink`) | tipo + o ATrack já valida o tenant; a pendência do jwsoft não se aplica ao portar para cá |
| — | `motorista String? @db.VarChar(100)` | **ATrack tem campo texto denormalizado** que o jwsoft não tem |
| — | `criado_em DateTime?` | ATrack não tem `updatedAt`; jwsoft tem `createdAt` + `updatedAt` |
| `createdAt` + `updatedAt` | só `criado_em` | ATrack não rastreia update |

Model faltando no ATrack que o fiscal usa: **`Viagem`** (jwsoft
`Viagem` liga `Motorista` + `Veiculo` + status; CT-e e CIOT têm `viagemId`
opcional/unique). O ATrack **não tem `Viagem` nem nada equivalente**. Decidir:
portar `Viagem`, ou desacoplar o fiscal dela (CT-e/MDF-e/CIOT do jwsoft já
aceitam `viagemId` nulo).

### 8.4. `Motorista` — ATrack × jwsoft

Campos **idênticos** em conteúdo (o jwsoft copiou do ATrack): `nome`, `cpf?`,
`cnh?`, `cnhCategoria?/cnh_categoria?`, `cnhValidade?/cnh_validade?`, `telefone?`,
`whatsapp?`, `ativo`, `observacao?`. Diferenças:

- PK: `String uuid` (jwsoft) × `Int autoincrement` (ATrack).
- `tenantId String` × `tenant_id Int`; camelCase × snake_case.
- jwsoft tem `createdAt` + `updatedAt`; ATrack só `criado_em` (sem update).
- jwsoft: `@@unique([tenantId, cpf])` — **ATrack NÃO tem unique em cpf**
  (nem global nem por tenant). Ao portar serviços fiscais que assumem CPF único
  por tenant, isso **não é garantido** no ATrack. Decidir: adicionar
  `@@unique([tenant_id, cpf])` em `motoristas` (migration futura, fora do escopo
  agora) ou o código fiscal tolera CPF duplicado.
- jwsoft `Motorista` tem relações `viagens`, `mdfes`, `veiculosPadrao`; o
  MDF-e/CIOT referenciam `motoristaId`.

### 8.5. Models fiscais do jwsoft a portar (e suas dependências)

| Model jwsoft | Depende de | Situação no jwsoft | Nota para portar |
|---|---|---|---|
| `EmpresaFiscal` | `Tenant` | CRUD completo, **não** integrado ao Cte/Mdfe ainda | Guarda `brasilNfeToken` (texto puro — TODO: cifrar), `certificadoPfxPath`/`certificadoSenha` (**path**, binário não vai pro Postgres). ATrack **não tem** object storage obrigatório (`S3_*` é opcional; default é disco em `/app/uploads`). `@@unique([tenantId, cnpj])`. |
| `ConhecimentoTransporte` (CT-e) | `Tenant`, `Cliente`, `Viagem?`, `ManifestoTransporte?` | Integração Brasil NFe implementada; teste bloqueado (certificado) | `chaveAcesso @unique @db.VarChar(44)` global; `xmlContent @db.Text`; `status` enum `StatusDocumentoFiscal`. **`Cliente` não existe no ATrack.** |
| `ManifestoTransporte` (MDF-e) | `Tenant`, `Veiculo?`, `Motorista?` | Implementado; mesmo bloqueio | agrupa vários CT-e; `numeroProtocolo` p/ encerramento. |
| `CiotOperacao` | `Tenant`, `EmpresaFiscal`, `Viagem?` | Não iniciado (próximo) | Campos ANTT variáveis como `Json` (`veiculos`, `infPagamento`, ...); `idOperacaoTransporte @unique` global. |
| `Cliente` | `Tenant` | `@@unique([tenantId, cnpjCpf])` | **Não existe no ATrack.** `notas_fiscais` é fornecedor de compra, não um cadastro de cliente/tomador. Decidir: portar `Cliente` como model novo, ou o CT-e referencia outra coisa. |
| `Viagem` | `Tenant`, `Motorista`, `Veiculo` | usado por CT-e/CIOT (opcional) | Não existe no ATrack (ver 8.3). |
| enums `StatusDocumentoFiscal`, `StatusViagem`, `StatusCiot` | — | enums Prisma | ATrack não usa enum — converter para `String` + Zod, ou abrir exceção à convenção. |

### 8.6. Segurança / multi-tenant — o que já está alinhado e o que checar

**Já compatível** (não precisa decisão, só seguir o padrão do ATrack):
- `tenant_id` sempre do JWT, nunca do body — igual à regra fixada do jwsoft.
- Revalidação de FK cruzada no mesmo tenant (`findFirst({ where:{ id, tenant_id }})`)
  — o ATrack já faz (`applyMotoristaLink`, `resolveCaminhaoId`); o jwsoft tem
  isso em `CteService` (valida `cliente`/`viagem` no tenant) e a pendência
  `Veiculo→Motorista` do jwsoft **já está resolvida no ATrack**.
- Captura de `P2002` → 409/400 no `errorHandler` central (o jwsoft faz
  `ConflictException` por serviço; no ATrack o handler global já cobre).

**A checar / decidir:**
- **Sem RLS no Postgres** em nenhum dos dois — isolamento é 100% aplicação. Todo
  query novo do módulo fiscal **tem que** carregar `where: { tenant_id }`
  manualmente (usar o helper `withTenant`). Sem isso, vaza. Não há rede de
  segurança no banco.
- `chaveAcesso` / `idOperacaoTransporte` são `@unique` **global** no jwsoft
  (simplificação assumida lá). Num banco multi-tenant de produção isso pode ser
  aceitável (chave de acesso é única nacionalmente) — **confirmar com o
  usuário** se mantém global ou vira `@@unique([tenant_id, chave_acesso])`.
- E-mail de usuário é **único global** no ATrack — se o módulo fiscal criar
  usuários próprios (não deve), esbarra nisso. O jwsoft também tem
  `Usuario.email @unique` global.
- `audit_logs` já registra toda mutação (`POST/PUT/PATCH/DELETE`) via `auditLog`
  middleware — as rotas fiscais entram nisso automaticamente se montadas no
  `apiRouter`. Bom para rastreabilidade de emissão.

### 8.7. Auth — payload JWT divergente

| | jwsoft | ATrack |
|---|---|---|
| Claims | `sub`, `tenantId` (string), `role` (`USER`/`ADMIN`), `email` | `sub`, `tenantId` (number), `role` (`admin`/`operator`), `email`, `nome`, `permissions` (string[]) |
| Expiração | 8h | 7d (`JWT_EXPIRES_IN`) |
| Lib | passport-jwt / `@nestjs/jwt` | `jsonwebtoken` direto |
| Acesso no handler | `@CurrentUser() u: JwtPayload` → `u.tenantId` | `req.context.user` / `requireTenantId(req)` |

Se o módulo fiscal for portado **com** o Auth do jwsoft, ele vira redundante (o
ATrack já tem `users`/JWT/RBAC). O caminho consistente é: **descartar
Auth/Tenant do jwsoft** e plugar os controllers fiscais no `requireAuth` +
`requirePermission` do ATrack (como a nota do jwsoft já antecipa: *"nosso módulo
Auth/Tenant provavelmente vira redundante nessa hora"*).

### 8.8. Lista consolidada de decisões pendentes do usuário

1. **Plano/feature:** o fiscal-transporte usa o plano `fiscal` atual, um plano
   novo, ou add-on do `complete`? Qual(is) feature-flag(s)? (implica editar
   `tenantFeatures.js` + Stripe + UI).
2. **Renomear** o plano/card "Fiscal" atual (que hoje é NF-e de compra/estoque)
   para não colidir?
3. **Tipo de PK** dos models fiscais ao entrar no ATrack: converter
   `String uuid` → `Int autoincrement` (consistente com o resto) ou manter uuid
   (inconsistente)? Isso afeta todas as FKs (`clienteId`, `viagemId`,
   `veiculoId`→`caminhao_id`, `motoristaId`, `empresaFiscalId`).
4. **`Cliente`** (tomador do CT-e): portar o model do jwsoft, ou mapear para
   algo existente? (o ATrack não tem cadastro de cliente).
5. **`Viagem`**: portar, ou rodar o fiscal sem viagem (`viagemId` nulo)?
6. **`Motorista.cpf`**: adicionar `@@unique([tenant_id, cpf])` no ATrack
   (migration futura) ou o código fiscal tolera CPF repetido?
7. **Enums** (`StatusDocumentoFiscal`, `StatusViagem`, `StatusCiot`): manter enum
   Prisma (fura a convenção do ATrack) ou virar `String` + Zod?
8. **XML fiscal**: coluna `@db.Text` (padrão jwsoft) ou object storage (padrão
   NF-de-compra do ATrack)?
9. **`chaveAcesso`/`idOperacaoTransporte`**: `@unique` global ou
   `@@unique([tenant_id, ...])`?
10. **`EmpresaFiscal` / certificado A1**: onde guardar o `.pfx` (o ATrack não
    exige S3; disco `/app/uploads` é volume no Coolify) e como cifrar
    token/senha (hoje texto puro no jwsoft, marcado TODO).
11. **Auth**: confirmar que o Auth/Tenant do jwsoft é descartado e os controllers
    fiscais passam a usar `requireAuth`/`requirePermission`/`requireTenantId` do
    ATrack.
12. **TypeScript no backend do ATrack**: introduzir build TS para acomodar o
    código Nest/TS do jwsoft, ou reescrever tudo em JS ESM?
13. **Nest.js**: o ATrack é Express puro — o código fiscal do jwsoft
    (módulos/DI/guards/DTOs class-validator) precisa ser **reescrito** no estilo
    `routes → controller (Zod) → service`. Não há caminho de "copiar e colar".

---

## Apêndice — arquivos-chave para consulta rápida

| Assunto | Caminho |
|---|---|
| Schema | [backend/prisma/schema.prisma](backend/prisma/schema.prisma) |
| Montagem do app / ordem de middleware | [backend/src/app.js](backend/src/app.js) |
| Auth / JWT / RBAC middleware | [backend/src/middleware/security.js](backend/src/middleware/security.js) |
| Catálogo de permissões | [backend/src/utils/permissions.js](backend/src/utils/permissions.js) |
| Feature-flags / planos | [backend/src/utils/tenantFeatures.js](backend/src/utils/tenantFeatures.js) |
| Tenant helpers | [backend/src/utils/tenant.js](backend/src/utils/tenant.js) |
| Billing / Stripe | [backend/src/services/BillingService.js](backend/src/services/BillingService.js) · [backend/src/controllers/billingController.js](backend/src/controllers/billingController.js) |
| Padrão service + validação cruzada de tenant | [backend/src/services/CaminhaoService.js](backend/src/services/CaminhaoService.js) · [backend/src/services/NotaFiscalService.js](backend/src/services/NotaFiscalService.js) |
| Model Prisma cru + `withTenant` | [backend/src/models/caminhoesModel.js](backend/src/models/caminhoesModel.js) |
| Zod: caminhão | [backend/src/schemas/caminhaoSchema.js](backend/src/schemas/caminhaoSchema.js) |
| Zod: usuário / roles | [backend/src/schemas/userSchema.js](backend/src/schemas/userSchema.js) |
| Motorista (schema Zod inline + service) | [backend/src/services/MotoristaService.js](backend/src/services/MotoristaService.js) |
| Error handler (Zod/Prisma/statusCode) | [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js) |
| Teste de isolamento multi-tenant | [backend/tests/integration/tenantIsolation.integration.test.js](backend/tests/integration/tenantIsolation.integration.test.js) |
| CLIs de tenant/billing | [backend/scripts/create-tenant.mjs](backend/scripts/create-tenant.mjs) · [backend/scripts/set-tenant-billing.mjs](backend/scripts/set-tenant-billing.mjs) |
| Prisma client + adapter + SSL | [backend/src/lib/prisma.js](backend/src/lib/prisma.js) |
| Config central (env) | [backend/src/config/index.js](backend/src/config/index.js) |
| Referência jwsoft (schema fiscal) | `C:\Users\enzol\jwsoft\backend\prisma\schema.prisma` · `C:\Users\enzol\jwsoft\claude.md` |
