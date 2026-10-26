# Build no Coolify: Base Directory = backend, Dockerfile = Dockerfile
# Não use apt install chromium (puxa GTK e estoura RAM no "exporting layers").
FROM node:20-bookworm-slim

# Bibliotecas mínimas para o Chrome (PDF) + pg_dump alinhado ao Postgres do Coolify.
# O metapacote debian `postgresql-client` traz v15 e falha com server mais novo
# ("server version mismatch"). Produção ATrack usa Postgres 18.x → client 18 (PGDG).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    fonts-liberation \
    fonts-dejavu-core \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxi6 \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/* \
  && /usr/lib/postgresql/18/bin/pg_dump --version \
  && /usr/lib/postgresql/18/bin/pg_dump --version | grep -Eq 'pg_dump \(PostgreSQL\) 18\.'

WORKDIR /app

ENV NODE_ENV=production \
    PRISMA_CLIENT_ENGINE_TYPE=library \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    PATH="/usr/lib/postgresql/18/bin:${PATH}"

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma/

# --ignore-scripts: postinstall rodaria ensure-chrome antes do COPY do código
RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate \
  && PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY . .

RUN mkdir -p uploads/caminhoes backups \
  && node -e "import { resolveChromeExecutable } from './src/utils/resolveChromeExecutable.js'; const p=resolveChromeExecutable(); if(!p) { console.error('Chrome do Puppeteer não encontrado no build'); process.exit(1); } console.log('Chrome OK:', p);"

EXPOSE 3020

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "const p=process.env.WORKER_HEALTH_PORT||process.env.PORT||3020; fetch('http://127.0.0.1:'+p+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
