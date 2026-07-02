# Coolify: Base Directory = frontend, Build Pack = Dockerfile, Port = 80
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Defina no Coolify (Build Arguments): VITE_API_URL, VITE_API_TOKEN
ARG VITE_API_URL=https://api-abbroto.jwsoftware.com.br
ARG VITE_API_TOKEN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_TOKEN=$VITE_API_TOKEN

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
