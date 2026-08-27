# Checklist Coolify — ATrack (frontend + API)

Use este guia quando o site mostrar **Bad Gateway (502)**, versão antiga em alguns PCs, ou após mudanças no código.

## Diagnóstico rápido (antes de mexer no Coolify)

No seu PC (PowerShell):

```powershell
curl.exe -sI https://abbroto.jwsoftware.com.br
curl.exe -sI https://api-abbroto.jwsoftware.com.br/health
curl.exe -s https://api-abbroto.jwsoftware.com.br/health
```

| Resultado | Significado |
|-----------|-------------|
| Site = **502**, API = **200** | Problema só no **serviço frontend** (container nginx parado ou porta errada). |
| Site = **200**, mas UI velha | Cache do navegador / **PWA (service worker)** — ver seção [Atualizar nos navegadores](#atualizar-nos-navegadores-dos-usuários). |
| API ≠ **200** | Problema no **backend** (logs, `DATABASE_URL`, migrações). |

**Apagar storage do Chrome não causa 502.** Só remove cache local e pode fazer o navegador ir direto ao servidor — se o frontend estiver fora, aparece o 502.

---

## Serviço 1 — Frontend (`abbroto.jwsoftware.com.br`)

### Configuration → General

| Campo | Valor |
|-------|--------|
| Domínio | `abbroto.jwsoftware.com.br` (HTTPS ativo) |
| **Ports Exposes** | `80` |
| **Port Mappings** | vazio ou `80` → container `80` (não use 5173) |

### Configuration → Build

| Campo | Valor |
|-------|--------|
| **Build Pack** | `Dockerfile` (não Nixpacks / Railpack automático) |
| **Base Directory** | `frontend` |
| **Dockerfile** | `Dockerfile` |
| **Build Arguments** | `VITE_API_URL=https://api-abbroto.jwsoftware.com.br` |
| | `VITE_AUTH_REQUIRED=true` |

A URL da API **não** deve terminar com `/api`.

### Configuration → Environment

Não é obrigatório variável de runtime para o SPA; o que importa é o **build argument** acima (valor vai embutido no JS no `npm run build`).

### Deploy

1. **Deploy** → marque **Clear build cache** (ou equivalente).
2. Aguarde build terminar sem erro.
3. Confirme status **Running** (não Restarting).
4. Abra **Logs**: deve aparecer nginx iniciando na porta 80, sem crash em loop.

### Se o build falhar em `npm ci` (exit code 255)

O log costuma cortar antes do erro real. Causas comuns no Coolify:

| Sintoma | Ação |
|---------|------|
| Para em `RUN npm ci` com exit **255** | Servidor sem RAM (OOM). O Dockerfile já evita download do Playwright; confira **≥ 2 GB** livres no host durante o build. |
| Build muito lento | **Clear build cache** e redeploy; primeira build baixa ~700 pacotes npm. |
| `npm ci` com erro de lockfile | Commitar `package-lock.json` atualizado junto com `package.json`. |

No deploy: marque **Clear build cache**, abra **Show Debug Logs** até o fim, e confira se `npm run build` e o estágio nginx completam.

### Se continuar 502

1. **Logs** do container: OOM, “address already in use”, build falhou?
2. **Restart** o serviço uma vez.
3. Confirme que não há outro serviço Coolify usando o mesmo domínio.
4. Em **Server** → recursos: disco/RAM suficientes.
5. Teste de novo: `curl.exe -sI https://abbroto.jwsoftware.com.br` → esperado **HTTP/1.1 200**.

---

## Serviço 2 — API (`api-abbroto.jwsoftware.com.br`)

### Configuration → Build

| Campo | Valor |
|-------|--------|
| **Build Pack** | `Dockerfile` |
| **Base Directory** | `backend` |
| **Dockerfile** | `Dockerfile` |

Alternativa: Base Directory `.` e Dockerfile na raiz (copia `backend/`).

### Configuration → Environment (mínimo)

| Variável | Exemplo / nota |
|----------|----------------|
| `DATABASE_URL` | PostgreSQL de produção |
| `PORT` | `3020` (ou a porta que o Coolify mapeia) |
| `NODE_ENV` | `production` |
| `AUTH_ENABLED` | `true` |
| `JWT_SECRET` | senha longa aleatória (≥ 16 caracteres) |
| `API_TOKEN` | opcional — só para scripts/CI (não embutir no frontend) |
| `CORS_ORIGINS` | `https://abbroto.jwsoftware.com.br` |
| `DB_SSL_MODE` | `require` ou `no-verify` (evite `disable` em produção) |
| `PRISMA_CLIENT_ENGINE_TYPE` | `library` |
| `REDIS_URL` | URL interna do Redis Coolify (fila ordem de coleta / BullMQ) |
| SMTP | se usar envio de e-mail |

**Remova** `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` se existir — o Dockerfile instala Chrome em `/app/.cache/puppeteer`.

### Redis (fila ordem de coleta)

No Coolify, adicione no serviço da **API**:

```
REDIS_URL=redis://default:SENHA@HOST_INTERNO:6379/0
```

Use a URL **interna** do serviço Redis (mesma rede do container da API). Sem `REDIS_URL`, a fila cai para memória e jobs podem se perder em restart/multi-réplica.

Após redeploy, confira `/health` → `redis.ok: true` e `redis.queueMode: "redis"`.

### Storage → Volume (obrigatório para PDFs)

| Mount path no container |
|-------------------------|
| `/app/uploads` |

Sem volume, PDFs de caminhões somem a cada redeploy.

### Deploy

1. **Clear build cache** no redeploy após mudanças no Dockerfile.
2. Build precisa de RAM (≥ 4 GB no servidor ajuda no export da imagem).
3. Valide: `curl.exe -s https://api-abbroto.jwsoftware.com.br/health`  
   - HTTP **200** e `status`: `healthy`  
   - `database.ok`: `true`  
   - `pdf.ready`: `true`  
   - `uploads.writable`: `true`  
   - Se `status` for `degraded` ou HTTP **503**, veja o array `issues` na resposta.

### Migrações (se API sobe mas dá erro de tabela)

No terminal do container backend (ou one-off):

```bash
npm run db:migrate
```

---

## Ordem recomendada de deploy

1. **API** — health OK.
2. **Frontend** — site 200 e login/listagens funcionando.
3. Teste em aba anônima: `https://abbroto.jwsoftware.com.br`.

---

## Atualizar nos navegadores dos usuários

Depois deste deploy do frontend, o app detecta versão nova sozinho:

1. Consulta `/version.json` a cada ~1 minuto e ao voltar para a aba.
2. Mostra faixa **“Nova versão disponível → Atualizar agora”** (não precisa pedir hard refresh).
3. No login, atualiza automaticamente.
4. O service worker também tenta `autoUpdate`.

**Primeiro deploy desta melhoria:** clientes que ainda estão na versão antiga precisam **abrir o site uma vez** (ou um hard refresh / desinstalar o atalho PWA). Depois disso, deploys futuros atualizam sozinhos em todos os tenants.

Se alguém continuar na tela velha:

1. Clique em **Atualizar agora** na faixa amarela, se aparecer.
2. Ou feche todas as abas do domínio e abra de novo.
3. Último recurso: F12 → Application → Service Workers → Unregister → limpar site data.

---

## Checklist pós-deploy (copiar e marcar)

- [ ] `curl.exe -sI https://abbroto.jwsoftware.com.br` → **200**
- [ ] `curl.exe -s https://api-abbroto.jwsoftware.com.br/health` → `status: "healthy"` (HTTP 200)
- [ ] Login e uma tela crítica (ex.: caminhões, ordem de coleta)
- [ ] Gerar/abrir um PDF de teste
- [ ] Aba anônima mostra menus/funcionalidades novas
- [ ] Um PC que estava “velho” testado após fechar todas as abas

---

## Backup (recomendado)

| O quê | Como |
|-------|------|
| **PostgreSQL** | Snapshot automático no provedor **ou** `npm run db:backup` (script `scripts/backup-db.mjs` — precisa de `pg_dump` + `DATABASE_URL`) |
| **PDFs em `/app/uploads`** | Backup do volume Coolify (caminhão documentos somem sem ele) |

### Agendar backup no Coolify

Crie um **Scheduled Job** (ou cron no host) diário, por exemplo às 03:00:

```bash
cd /app && npm run db:backup -- --out=/app/backups
```

Monte um volume em `/app/backups` (ou use snapshot do Postgres gerenciado). Guarde pelo menos 7 dias.

---

## Worker PDF / e-mail (ordem de coleta) e digest

Em produção, o worker roda **dentro da API por padrão**. Só desligue se tiver um serviço separado:

`RUN_ORDEM_WORKER_IN_API=false` + comando `npm run worker:ordem-coleta`.

### Serviço worker (Coolify) — opcional / escala

1. Novo serviço a partir do mesmo `backend/Dockerfile`.
2. Command / start: `npm run worker:ordem-coleta`
3. Mesmas env da API: `DATABASE_URL`, `REDIS_URL`, SMTP, `NODE_ENV=production`, e `RUN_ORDEM_WORKER_IN_API=false` na API.
4. Sem porta HTTP pública.

### Digest semanal

Cron (ex.: segunda 08:00 America/Sao_Paulo):

```bash
npm run job:weekly-digest
```

Requer SMTP (e WhatsApp se habilitado no tenant).

### Sentry (frontend)

Opcional: carregue o SDK do Sentry no HTML/CDN com `window.Sentry`. O `ErrorBoundary` envia erros via `frontend/src/lib/monitoring.js` quando `Sentry` estiver disponível. Build arg exemplo:

```
VITE_SENTRY_DSN=https://...@o....ingest.sentry.io/...
```

(hoje o hook usa `window.Sentry` se presente — sem forçar pacote npm).

---

## Referência no repositório

- Frontend Docker: `frontend/Dockerfile`, `frontend/nginx.conf`
- API Docker: `backend/Dockerfile`
- PWA: `frontend/vite.config.js`
- README: seções *Deploy do backend* e *Deploy do frontend*
