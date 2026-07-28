# Raffle Royale Jobs

This package runs ad-hoc database commands and the long-running SQS worker used by the app.

## What it does

- Runs one-off administrative commands such as database health checks, stats, migrations, and seeding.
- Runs a polling worker when `JOBS_SQS_QUEUE_URL` is set.
- Accepts job messages from ElasticMQ or AWS SQS and dispatches them to the matching command.

## Commands

Run these from the repo root with the `jobs` workspace selected:

```bash
npm run dev -w jobs -- <command> [args]
npm run start -w jobs -- <command> [args]
```

Available commands:

| Command | Description | Args |
| --- | --- | --- |
| `migrate` | Apply pending Prisma migrations with `prisma migrate deploy`. | None |
| `db:health` | Verify the database is reachable with `SELECT 1`. | None |
| `db:stats` | Print row counts for the core raffle tables. | None |
| `seed` | Hydrate the database from a YAML fixture file. | Optional fixture path |
| `sweep` | Resolve winners for eligible raffles that are missing winner selection. | None |

Examples:

```bash
npm run dev -w jobs -- db:health
npm run dev -w jobs -- db:stats
npm run dev -w jobs -- migrate
npm run dev -w jobs -- seed
npm run dev -w jobs -- seed fixtures/custom-seed.yaml
npm run dev -w jobs -- sweep
```

## Running as a worker

If `JOBS_SQS_QUEUE_URL` is present and no command is provided, the app starts the SQS worker.
If you pass an explicit command such as `sweep`, command mode takes precedence.

The worker also uses these environment variables:

- `JOBS_SQS_QUEUE_URL`: queue to poll for job messages.
- `JOBS_SQS_REPLY_QUEUE_URL`: default reply queue, used when a message does not specify one.
- `JOBS_SQS_ENDPOINT_URL`: optional custom SQS endpoint such as ElasticMQ.
- `QUEUE_MESSAGE_SIGNING_KEY`: shared symmetric key used to verify incoming message `sig` and sign replies.
- `AWS_REGION`: AWS region for the SQS client.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: required for local SQS-compatible endpoints like ElasticMQ.
- `DATABASE_URL`: required for commands that use Prisma.

## Job message format

Send a JSON object to the queue with this shape:

```json
{
  "id": "job-123",
  "command": "db:health",
  "args": [],
  "replyQueueUrl": "http://elasticmq:9324/000000000000/raffle-royale-jobs-replies",
  "sig": "<sha256-signature>"
}
```

Fields:

- `id` is required and must be a non-empty string.
- `command` is required and must match one of the commands listed above.
- `args` is optional and must be an array of strings when provided.
- `replyQueueUrl` is optional and must be a string when provided.
- `sig` is required and must be generated with `@raffleroyale/queue-signature`.

### Example messages

Run a database health check:

```json
{
  "id": "job-db-health-001",
  "command": "db:health"
}
```

Run the seed command with a custom fixture file:

```json
{
  "id": "job-seed-001",
  "command": "seed",
  "args": ["fixtures/seed.yaml"]
}
```

## Replies

When a reply queue is configured, the worker sends a signed reply message after the command finishes.

Reply payload shape:

```json
{
  "id": "job-db-health-001",
  "command": "db:health",
  "success": true,
  "exitCode": 0,
  "timestamp": "2026-06-04T12:00:00.000Z"
}
```

On failure, `success` is `false`, `exitCode` is `1`, and `error` contains the failure message.

## Invalid messages

Messages that fail validation or signature verification are treated as invalid, logged, and deleted from the queue so they do not loop forever.

## Seed fixture

The default seed fixture is [fixtures/seed.yaml](fixtures/seed.yaml). It contains users, raffles, transactions, tickets, payouts, and raffle events that are inserted in a single transaction.

If `dateAnchor` is set at the top level of the fixture, all fixture timestamps are shifted by the delta between `dateAnchor` and the current runtime. This keeps the seeded raffle mix fresh (active, future, and expired) without rewriting every hardcoded date.

## Local development

The dev compose file wires the worker to ElasticMQ and the database. If you need to inspect queued messages, use the ElasticMQ UI on port `9325`.