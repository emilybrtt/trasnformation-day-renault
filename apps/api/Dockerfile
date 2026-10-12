# Build a partir da RAIZ do monorepo (precisa do workspace inteiro para o npm
# resolver @gavve/shared): docker build -f apps/api/Dockerfile -t gavve-api .
#
# Só prepara a imagem — ver docs/DEPLOY.md. Nada aqui roda automaticamente.

FROM node:20-alpine AS base
# Sem isso, o Prisma não detecta a versão do OpenSSL (nem em build nem em
# runtime) e tenta carregar o motor nativo errado — descoberto testando o
# container de verdade, não só o build (B14).
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared packages/shared
COPY apps/api apps/api
# npm ci já dispara o postinstall do packages/shared (gera o dist/ do pacote
# compartilhado) — por isso o código-fonte (não só o package.json) precisa estar
# copiado antes do `npm ci`, não depois.
RUN npm ci
RUN npm run build -w @gavve/shared && npm run build -w @gavve/api

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
# A pasta inteira (não só dist/package.json/prisma): o npm workspaces às vezes
# aninha uma dependência direto em apps/api/node_modules em vez de hoistear pra
# raiz (foi o caso do multer) — copiar só o node_modules raiz deixa isso de fora.
COPY --from=build /app/apps/api ./apps/api
CMD ["node", "apps/api/dist/index.js"]
