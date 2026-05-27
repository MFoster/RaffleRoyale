# Raffle Royale

An npm workspace monorepo with:

- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend

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
npm run prisma:generate -w api
npm run dev
```

## Workspace scripts

```bash
npm run dev      # start web and api together
npm run dev:web  # start only the Next.js app
npm run dev:api  # start only the NestJS API
npm run build    # build all workspaces
npm run lint     # lint all workspaces
npm run test     # run workspace tests
```

## Default local URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

The API enables CORS for `http://localhost:3000` by default. Override with `PORT` and `FRONTEND_URL` when needed.

Set `NEXT_PUBLIC_API_URL` (frontend) if the API is not running on `http://localhost:3001`.

## Prototype flow

Once the web and API are running, the homepage supports the full prototype journey:

1. Create an account
2. Log in
3. Create an active raffle
4. Browse raffles and purchase tickets
