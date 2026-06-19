# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/jobs/package.json apps/jobs/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/queue-signature/package.json packages/queue-signature/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace jobs --include-workspace-root=false

FROM deps AS dev
ENV NODE_ENV=development
COPY packages/db/prisma packages/db/prisma
COPY packages/queue-signature packages/queue-signature
ENTRYPOINT ["node_modules/.bin/tsx", "apps/jobs/src/index.ts"]
CMD ["bash"]

FROM deps AS build
COPY apps/jobs/src apps/jobs/src
COPY apps/jobs/tsconfig.json apps/jobs/tsconfig.json
COPY packages/db/package.json packages/db/package.json
COPY packages/db/prisma packages/db/prisma
COPY packages/queue-signature packages/queue-signature
RUN npm run prisma:generate -w jobs
RUN npm run build -w jobs

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/jobs/package.json apps/jobs/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/queue-signature/package.json packages/queue-signature/package.json
COPY packages/db/prisma packages/db/prisma
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace jobs --include-workspace-root=false
RUN npm run prisma:generate -w jobs

FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/jobs/package.json apps/jobs/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/queue-signature packages/queue-signature
COPY packages/db/prisma packages/db/prisma
COPY --from=build /workspace/apps/jobs/dist apps/jobs/dist
COPY apps/jobs/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
CMD []
