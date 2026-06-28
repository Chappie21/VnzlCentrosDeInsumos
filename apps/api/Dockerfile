# syntax=docker/dockerfile:1
# Imagen de la API NestJS (monorepo pnpm). Build context = raíz del repo:
#   docker build -f apps/api/Dockerfile -t vnzl-api .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
# openssl: requerido por Prisma en runtime.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build: instala todo, compila deps internas + genera Prisma + nest build ----
FROM base AS build
# Manifests primero para cachear la capa de dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/venezuela/package.json packages/venezuela/
# --ignore-scripts: evita prepare/postinstall (prisma generate corre luego, con el schema ya copiado).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# Orden explícito (sin turbo: su binario se baja en postinstall, saltado arriba).
RUN pnpm --filter @vnzl/venezuela build \
  && pnpm --filter @vnzl/database build \
  && pnpm --filter @vnzl/api build
# ponytail: no se hace `pnpm prune --prod` — reinstala node_modules y borra el
# cliente Prisma generado (vive en el store de pnpm). Se acepta la imagen con
# devDeps. Si el tamaño importa: regenerar Prisma después de podar.

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
# Plataformas (Render/Railway/Cloud Run) inyectan PORT; main.ts lo lee con fallback.
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
