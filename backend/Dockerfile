# Build no Coolify: Base Directory = backend, Dockerfile = Dockerfile
# Não use apt install chromium (puxa GTK e estoura RAM no "exporting layers").
FROM node:20-bookworm-slim

# Bibliotecas mínimas para o Chrome instalado pelo Puppeteer (PDF)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
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
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PRISMA_CLIENT_ENGINE_TYPE=library \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma/

# --ignore-scripts: postinstall rodaria ensure-chrome antes do COPY do código
RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate \
  && PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY . .

RUN mkdir -p uploads/caminhoes \
  && node -e "import { resolveChromeExecutable } from './src/utils/resolveChromeExecutable.js'; const p=resolveChromeExecutable(); if(!p) { console.error('Chrome do Puppeteer não encontrado no build'); process.exit(1); } console.log('Chrome OK:', p);"

EXPOSE 3020

CMD ["npm", "start"]
