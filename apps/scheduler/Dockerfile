FROM node:22-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
COPY package-lock.json package.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/jobs/package.json apps/jobs/
COPY apps/scheduler/package.json apps/scheduler/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace scheduler --include-workspace-root=false

FROM base AS build
COPY package-lock.json package.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/jobs/package.json apps/jobs/
COPY apps/scheduler/package.json apps/scheduler/
COPY apps/web/package.json apps/web/
COPY apps/scheduler/tsconfig.json apps/scheduler/
COPY apps/scheduler/jest.config.js apps/scheduler/
COPY apps/scheduler/src apps/scheduler/src
RUN npm ci --workspace scheduler --include-workspace-root=false
RUN npm run build -w scheduler

FROM base AS dev
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY apps/scheduler/package.json apps/scheduler/
COPY apps/scheduler/tsconfig.json apps/scheduler/
COPY apps/scheduler/src apps/scheduler/src
WORKDIR /workspace/apps/scheduler
EXPOSE 3002
CMD ["/workspace/node_modules/.bin/tsx", "watch", "src/main.ts"]

FROM base AS prod
ENV NODE_ENV=production
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY --from=build /workspace/apps/scheduler/dist /workspace/apps/scheduler/dist
COPY apps/scheduler/package.json /workspace/apps/scheduler/
WORKDIR /workspace/apps/scheduler
EXPOSE 3002
CMD ["node", "dist/main.js"]
