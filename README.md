# Raffle Royale

An npm workspace monorepo with:

- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend
- `apps/jobs` - Node.js command runner for database and background jobs

## Getting started

```bash
npm install
npm run dev
```

## Workspace scripts

```bash
npm run dev      # start web and api together
npm run dev:web  # start only the Next.js app
npm run dev:api  # start only the NestJS API
npm run dev:jobs # start the jobs runner (CLI mode)
npm run build    # build all workspaces
npm run lint     # lint all workspaces
npm run test     # run workspace tests
```

## GitHub Actions CI/CD

The repository includes two dedicated workflow files:

- `.github/workflows/ci-pr-main.yml`: on **pull requests to `main`**, run `npm ci`, `npm run lint`, `npm run test`, and `npm run build`.
- `.github/workflows/push-main-ecr.yml`: on **pushes to `main`** (including merged PRs), run the same checks, then build and push Docker images for `api` and `web` to Amazon ECR using each Dockerfile `prod` target.

Configure these GitHub repository settings before enabling ECR publish:

- **Secret**: `AWS_ROLE_TO_ASSUME` (IAM role ARN for GitHub OIDC auth)
- **Variable**: `AWS_REGION` (for example `us-east-1`)
- **Variable**: `ECR_REPOSITORY_PREFIX` (images are pushed as `<prefix>-api` and `<prefix>-web`)
- **Variable**: `WEB_API_PROXY_TARGET` (optional, defaults to `http://localhost:3001`; used as the web Docker build arg)

## Jobs app

`apps/jobs` is a Node.js CLI workspace intended for ad-hoc and scheduled jobs.

Run available commands:

```bash
npm run jobs -- --help
```

Examples:

```bash
npm run jobs -- db:health
npm run jobs -- db:stats
npm run jobs -- seed
```

The jobs app loads environment variables from `apps/jobs/.env` and `apps/api/.env` (if present), and expects `DATABASE_URL` for DB commands.

The default seed fixture path is:

```bash
apps/jobs/fixtures/seed.yaml
```

You can pass a custom fixture file path:

```bash
npm run jobs -- seed ./fixtures/my-seed.yaml
```

Seed fixture `users` should provide plaintext `password` values. The jobs seed
command hashes each password with bcrypt before writing users to the database.
The default fixture currently uses `SeedPass123!` for all seeded users.

## Docker

Development stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Production-style stack:

```bash
docker compose -f docker-compose.prod.yml up --build
```

The compose files start:

- `web` on `http://localhost:3100`
- `api` on `http://localhost:3101`
- `db` on `localhost:5432`

The API container runs Prisma migrations on startup against the Compose Postgres service.
The web app proxies all `/api/*` requests through a Next.js rewrite. In Docker, `API_PROXY_TARGET=http://api:3001` forwards those requests to the API service.
For production images, this value is also passed as a Docker build arg so the rewrite target is baked correctly at build time.

## Default local URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

The API enables CORS for `http://localhost:3000` by default. Override with `PORT` and `FRONTEND_URL` when needed.

The API also runs an internal raffle expiration scheduler every minute. Set
`RAFFLE_EXPIRATION_CRON_ENABLED=false` to disable background expiration
processing.

### Web API proxy

The frontend should call `/api/...` only. Next.js rewrites this path to the API target defined by:

```bash
API_PROXY_TARGET=http://localhost:3001
```

For server-side fetches to this same Next app (before rewrite), you can optionally set:

```bash
NEXT_SERVER_ORIGIN=http://localhost:3000
```
