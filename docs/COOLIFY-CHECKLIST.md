# Checklist Coolify — ABrotto (frontend + API)

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

A URL da API **não** deve terminar com `/api`.

### Configuration → Environment

Não é obrigatório variável de runtime para o SPA; o que importa é o **build argument** acima (valor vai embutido no JS no `npm run build`).

### Deploy

1. **Deploy** → marque **Clear build cache** (ou equivalente).
2. Aguarde build terminar sem erro.
3. Confirme status **Running** (não Restarting).
4. Abra **Logs**: deve aparecer nginx iniciando na porta 80, sem crash em loop.

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
| `CORS_ORIGINS` | `https://abbroto.jwsoftware.com.br` |
| `PRISMA_CLIENT_ENGINE_TYPE` | `library` |
| SMTP | se usar envio de e-mail |

**Remova** `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` se existir — o Dockerfile instala Chrome em `/app/.cache/puppeteer`.

### Storage → Volume (obrigatório para PDFs)

| Mount path no container |
|-------------------------|
| `/app/uploads` |

Sem volume, PDFs de caminhões somem a cada redeploy.

### Deploy

1. **Clear build cache** no redeploy após mudanças no Dockerfile.
2. Build precisa de RAM (≥ 4 GB no servidor ajuda no export da imagem).
3. Valide: `curl.exe -s https://api-abbroto.jwsoftware.com.br/health`  
   - `status`: `healthy`  
   - `pdf.chromiumPath`: caminho válido  
   - `uploads.writable`: `true`

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

Depois de um deploy novo do frontend:

1. Feche **todas** as abas do domínio `abbroto.jwsoftware.com.br`.
2. Abra de novo (ou aba anônima para testar).
3. Se ainda estiver velho: DevTools (F12) → **Application** → **Service Workers** → *Unregister* → recarregar.
4. Opcional: **Clear site data** (só se necessário; apaga preferências locais de tema/página).

O app usa PWA com atualização automática; com `skipWaiting` no Workbox, a nova versão tende a aplicar mais rápido após o servidor voltar com 200.

---

## Checklist pós-deploy (copiar e marcar)

- [ ] `curl.exe -sI https://abbroto.jwsoftware.com.br` → **200**
- [ ] `curl.exe -s https://api-abbroto.jwsoftware.com.br/health` → `healthy`
- [ ] Login e uma tela crítica (ex.: caminhões, ordem de coleta)
- [ ] Gerar/abrir um PDF de teste
- [ ] Aba anônima mostra menus/funcionalidades novas
- [ ] Um PC que estava “velho” testado após fechar todas as abas

---

## Referência no repositório

- Frontend Docker: `frontend/Dockerfile`, `frontend/nginx.conf`
- API Docker: `backend/Dockerfile`
- PWA: `frontend/vite.config.js`
- README: seções *Deploy do backend* e *Deploy do frontend*
