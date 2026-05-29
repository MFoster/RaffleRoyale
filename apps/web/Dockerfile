# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace web --include-workspace-root=false

FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "web", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS build
ARG API_PROXY_TARGET=http://localhost:3001
ENV API_PROXY_TARGET=$API_PROXY_TARGET
COPY apps/web apps/web
RUN npm run build -w web

FROM node:20-bookworm-slim AS prod
WORKDIR /workspace
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /workspace/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
