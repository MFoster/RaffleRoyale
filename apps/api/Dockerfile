# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npm", "run", "start:dev", "-w", "api"]

FROM deps AS build
COPY . .
RUN npm run prisma:generate -w api
RUN npm run build -w api

FROM base AS prod-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace api
RUN npm run prisma:generate -w api

FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY --from=build /workspace/apps/api/dist apps/api/dist
WORKDIR /workspace/apps/api
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
