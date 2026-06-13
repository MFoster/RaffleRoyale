# Raffle Royale

An npm workspace monorepo with:

- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend
- `apps/jobs` - Node.js command runner for database and background jobs

## Prototype scope

This repository currently targets a prototype/MVP with four outcomes:

1. Deployable web + API stack
2. User sign up and log in
3. Rafflers can create and list raffles
4. Participants can buy raffle tickets

### Deferred after the prototype

- Stripe integration
- Escrow and payout orchestration
- KYC/fraud workflows
- Promotions, reputation, and complex admin tooling
- Real-time push updates

## Getting started

```bash
npm install
npm run prisma:generate
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

- `.github/workflows/ci-pr-main.yml`: on **pull requests to `main`**, run `npm ci`, `npm run prisma:generate`, `npm run lint`, `npm run test`, and `npm run build`.
- `.github/workflows/push-main-ecr.yml`: on **pushes to `main`** (including merged PRs), run the same checks, build and push Docker images for `api` and `web` to Amazon ECR, then deploy both services to ECS Fargate.

Configure these GitHub repository settings before enabling ECR publish:

- **Secret**: `AWS_ROLE_TO_ASSUME` (IAM role ARN for GitHub OIDC auth)
- **Variable**: `AWS_REGION` (for example `us-east-1`)
- **Variable**: `ECR_REPOSITORY_PREFIX` (images are pushed as `<prefix>-api` and `<prefix>-web`)
- **Variable**: `WEB_API_PROXY_TARGET` (required; internal API URL used as the web Docker build arg, for example `http://api.raffle-royale.internal:3001`)
- **Variable**: `ENFORCE_HTTPS` (`false` by default; set `true` once your domain + cert are ready)

Configure these additional settings for ECS deploy:

- **Variable**: `ECS_CLUSTER` (default `raffle-royale`)
- **Variable**: `ECS_API_SERVICE` (default `raffle-royale-api`)
- **Variable**: `ECS_WEB_SERVICE` (default `raffle-royale-web`)
- **Variable**: `ECS_FRONTEND_URL` (required public URL used by API CORS; when `ENFORCE_HTTPS=true` it must be HTTPS)
- **Variable**: `ECS_API_UPLOADS_EFS_FILESYSTEM_ID` (EFS file system ID used for API uploads)
- **Variable**: `ECS_API_UPLOADS_EFS_ACCESS_POINT_ID` (EFS access point ID mounted at `/workspace/apps/api/uploads`)
- **Secret**: `ECS_API_DATABASE_URL`
- **Secret**: `ECS_JWT_SECRET`
- **Secret**: `ECS_JWT_REFRESH_SECRET`

One-time AWS bootstrap for ECS/Fargate (default VPC + public ALB + api/web services):

```bash
chmod +x scripts/aws/provision-ecs-fargate.sh
AWS_REGION=us-east-1 \
PUBLIC_DOMAIN=raffle.example.com \
ROUTE53_HOSTED_ZONE_ID=Z1234567890ABC \
ENABLE_HTTPS=true \
./scripts/aws/provision-ecs-fargate.sh
```

If you already have an issued ACM certificate, pass `ACM_CERTIFICATE_ARN` instead of creating one via Route53.
If your domain is not ready yet, leave `ENABLE_HTTPS` unset (or set `ENABLE_HTTPS=false`) to provision HTTP-only first.

The script provisions/updates:
- ECS cluster + services (`raffle-royale-api`, `raffle-royale-web`)
- ALB + target groups (public traffic defaults to web service)
- Optional HTTPS mode (`ENABLE_HTTPS=true`): ACM + HTTPS listener with HTTP(80) redirect to HTTPS
- Security groups and CloudWatch log groups
- ACM certificate DNS validation records and Route53 alias (when HTTPS mode is enabled and `PUBLIC_DOMAIN` + `ROUTE53_HOSTED_ZONE_ID` are provided)
- Cloud Map private DNS namespace + API service discovery record for internal web→api proxy
- EFS file system + mount targets + API uploads access point
- ECS task execution/task roles (if missing)
- Initial ECS task definitions from `.aws/ecs/task-definition-*.json`

By default, the API is not publicly exposed through ALB path routing. If you need public ALB `/api/*` forwarding, set `EXPOSE_API_VIA_ALB=true` when running the provisioning script.

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

Prisma schema and migrations are owned by `packages/db/prisma` and shared by both API and jobs scripts.

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
- `scheduler` on `http://localhost:3102`
- `db` on `localhost:5432`

Production image strategy:

- Keep npm workspaces (single root `package-lock.json`) and install only the target workspace in Docker (`npm ci --workspace <name> --include-workspace-root=false`).
- `apps/web/Dockerfile` uses Next.js standalone output so runtime image copies only standalone server output, static assets, and `public/`.
- `apps/api/Dockerfile` keeps a workspace-scoped production dependency stage and copies only runtime artifacts (`dist`, Prisma schema/client assets, package manifest).

The API container runs Prisma migrations on startup against the Compose Postgres service.
The web app proxies all `/api/*` requests through a Next.js rewrite. In Docker, `API_PROXY_TARGET=http://api:3001` forwards those requests to the API service.
For production images, this value is also passed as a Docker build arg so the rewrite target is baked correctly at build time (`WEB_API_PROXY_TARGET` should point to the internal API discovery URL, not the public ALB URL). Server-side web data fetches also use `API_PROXY_TARGET` directly at runtime to avoid self-calling the web server.

## Default local URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

The API enables CORS for `http://localhost:3000` by default. Override with `PORT` and `FRONTEND_URL` when needed.

The API also runs an internal raffle expiration scheduler every minute. Set
`RAFFLE_EXPIRATION_CRON_ENABLED=false` to disable background expiration
processing.
Raffle image uploads are stored as owner-scoped pending uploads and are claimed
when the raffle is created. Expired unclaimed uploads are cleaned hourly; set
`RAFFLE_IMAGE_UPLOAD_CLEANUP_ENABLED=false` to disable that cleanup job.
In ECS/Fargate, the API uploads directory is backed by EFS via the API task
definition volume mount at `/workspace/apps/api/uploads`.

### Web API proxy

The frontend should call `/api/...` only. Next.js rewrites this path to the API target defined by:

```bash
API_PROXY_TARGET=http://localhost:3001
```

For server-side fetches to this same Next app (before rewrite), you can optionally set:

```bash
NEXT_SERVER_ORIGIN=http://localhost:3000
```
Set `NEXT_PUBLIC_API_URL` (frontend) if the API is not running on `http://localhost:3001`.

## Prototype flow

Once the web and API are running, the homepage supports the full prototype journey:

1. Create an account
2. Log in
3. Create an active raffle
4. Browse raffles and purchase tickets
