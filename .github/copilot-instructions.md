# Raffle Royale Copilot Instructions

## Build, test, and lint commands

- Install dependencies from the repo root with `npm install`.
- Start both apps with `npm run dev`.
- Start a single workspace with `npm run dev:web` or `npm run dev:api`.
- Build everything with `npm run build`.
- Lint everything with `npm run lint`.
- Run the default workspace test suite with `npm run test`.
- Run API e2e tests explicitly with `npm run test:e2e -w api`.
- Run a single API unit test file with `npm run test -w api -- --runTestsByPath src/raffles/raffles.service.spec.ts`.
- Run a single API e2e test file with `npm run test:e2e -w api -- --runInBand --runTestsByPath test/access.e2e-spec.ts`.

## High-level architecture

- This repository is an npm workspace monorepo with `apps/web` (Next.js 16 / React 19 App Router frontend) and `apps/api` (NestJS backend).
- The API is where the real product logic lives today. `apps/web` is still close to the default scaffold, while the raffle/auth/domain behavior is implemented in `apps/api`.
- `apps/api` is organized by Nest modules: `AuthModule`, `UsersModule`, `RafflesModule`, plus a shared `PrismaModule` wired into `AppModule`.
- Persistence is PostgreSQL through Prisma (`apps/api/prisma/schema.prisma`). The schema centers on `User`, `Raffle`, `Ticket`, `Transaction`, `Payout`, and `RaffleEvent`.
- The raffle lifecycle is implemented in `apps/api/src/raffles/raffles.service.ts`: create raffle, purchase tickets, mark sold out, resolve winner, disband/refund expired raffles, and process expired raffles in batch.
- Concurrency safety is intentional. Ticket purchase and other lifecycle transitions use Prisma transactions with `Serializable` isolation plus explicit `SELECT ... FOR UPDATE` row locks on the raffle row.
- Audit/history is first-class: lifecycle changes are recorded in `RaffleEvent`, so feature work on raffle state usually needs both the main write and an event write.
- API auth is JWT-based. `JwtAuthGuard` populates `request.auth`, `RolesGuard` enforces `@Roles(...)`, and controllers use `@CurrentAuth()` for ownership checks.
- The API boots with a global Nest `ValidationPipe` configured with `transform: true`, `whitelist: true`, and `forbidNonWhitelisted: true`, so DTOs define the real request contract.
- The API expects PostgreSQL configuration through `apps/api/.env.example`; local defaults assume the API on `http://localhost:3001` and the web app on `http://localhost:3000`.

## Key conventions

- Follow the existing auth access pattern instead of re-inventing per-route checks:
  - mark open routes with `@Public()`
  - use `@Roles('ADMIN')` for admin-only endpoints
  - use `@CurrentAuth()` in controllers for self-vs-admin ownership checks
- Keep authorization decisions in controllers and core raffle/business rules in services. Current controllers block cross-user actions before calling the service layer.
- Normalize user emails to lowercase and store passwords as bcrypt hashes; do not add flows that compare or persist raw passwords.
- Treat raffle state changes as an audited workflow. When adding a new lifecycle transition, update the raffle/transaction records and append the corresponding `RaffleEvent`.
- Preserve the current transaction model for ticketing and lifecycle actions: use database transactions and row locking instead of in-memory coordination.
- DTO validation is strict and class-validator-driven. Reuse DTOs and decorators instead of accepting loose request shapes.
- The root lint command is not read-only for the API: `apps/api` runs ESLint with `--fix`, so linting may rewrite files.
- Current API e2e tests are controller/guard wiring tests, not real database integration tests. They override `AuthService`, `UsersService`, and `RafflesService`, so use them to preserve route contracts and access rules; add separate integration coverage if behavior depends on Prisma/Postgres.
- `apps/web/AGENTS.md` applies to frontend changes: this repo uses Next.js 16, so read the relevant docs in `node_modules/next/dist/docs/` before making assumptions based on older Next.js patterns.

## MCP servers

- Preferred Copilot Cloud Agent MCP configuration for this repo is checked in at `.github/copilot-mcp-config.json`.
- Configure that JSON in GitHub repository **Settings -> Copilot -> Cloud agent -> MCP configuration**.
- The repo currently prefers:
  - `playwright` for browser automation against the Next.js app
  - `github` (readonly endpoint) for repository, issue, pull request, Actions, and web search context
