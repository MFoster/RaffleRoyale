# Raffle Royale

An npm workspace monorepo with:

- `apps/web` - Next.js frontend
- `apps/api` - NestJS backend

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
npm run build    # build all workspaces
npm run lint     # lint all workspaces
npm run test     # run workspace tests
```

## Default local URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

The API enables CORS for `http://localhost:3000` by default. Override with `PORT` and `FRONTEND_URL` when needed.
