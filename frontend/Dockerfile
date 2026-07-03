# Coolify: Base Directory = frontend, Build Pack = Dockerfile, Port = 80
FROM node:20-alpine AS build

WORKDIR /app

# Playwright é só para testes e2e; evita download de browsers (~400MB) e OOM no build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
ENV CI=true

COPY package.json package-lock.json ./
# --ignore-scripts: pula postinstall do Playwright e reduz RAM no servidor
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .

# Defina no Coolify (Build Arguments): VITE_API_URL, VITE_API_TOKEN
ARG VITE_API_URL=https://api-abbroto.jwsoftware.com.br
ARG VITE_API_TOKEN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_TOKEN=$VITE_API_TOKEN
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
