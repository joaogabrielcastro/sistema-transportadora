# Deploy do backend a partir da RAIZ do repositório (Coolify com Base Directory = .)
# Preferível: Base Directory = backend e Dockerfile = Dockerfile (usa backend/Dockerfile)
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && test -x /usr/bin/chromium \
  && ! head -c 200 /usr/bin/chromium | grep -qi snap

WORKDIR /app

ENV NODE_ENV=production \
    PRISMA_CLIENT_ENGINE_TYPE=library \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma ./prisma/

RUN npm ci --omit=dev

COPY backend/ .

RUN mkdir -p uploads/caminhoes

EXPOSE 3020

CMD ["npm", "start"]
