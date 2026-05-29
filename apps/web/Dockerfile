# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "web", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS build
ARG API_PROXY_TARGET=http://localhost:3001
ENV API_PROXY_TARGET=$API_PROXY_TARGET
COPY . .
RUN npm run build -w web

FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace web

FROM base AS prod
ENV NODE_ENV=production
COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/next.config.ts apps/web/next.config.ts
COPY apps/web/public apps/web/public
COPY --from=build /workspace/apps/web/.next apps/web/.next
WORKDIR /workspace/apps/web
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
