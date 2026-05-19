# Build no Coolify: Base Directory = backend, Dockerfile = Dockerfile
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && test -x /usr/bin/chromium

WORKDIR /app

ENV NODE_ENV=production \
    PRISMA_CLIENT_ENGINE_TYPE=library \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads/caminhoes

EXPOSE 3020

CMD ["npm", "start"]
