# API (Prototype MVP)

This NestJS API supports the current Raffle Royale prototype scope:

1. User sign up
2. User log in
3. Create and list raffles
4. Purchase raffle tickets

## Local setup

From the repository root:

```bash
npm install
npm run prisma:generate -w api
```

Copy `apps/api/.env.example` to `apps/api/.env`, then provide a PostgreSQL database in `DATABASE_URL`.

## Run locally

From the repository root:

```bash
npm run dev:api
```

The API runs on `http://localhost:3001` by default.

## Prototype endpoints

- `POST /users` — create an email/password account
- `POST /auth/login` — exchange credentials for tokens
- `GET /raffles` — list raffles for browsing
- `POST /raffles` — create a raffle as the authenticated user
- `POST /raffles/:id/purchase` — buy tickets as the authenticated user

Advanced payments, escrow, KYC, promotions, and other roadmap features remain deferred until after the prototype.
