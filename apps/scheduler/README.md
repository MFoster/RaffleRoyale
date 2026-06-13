# Scheduler service

Local-only EventBridge Scheduler-compatible service implemented with NestJS.

## Responsibilities

- Accept EventBridge-compatible `POST /schedules` payloads (and local payload format)
- Persist schedules in SQLite
- Execute due one-time schedules in a worker loop
- Send payloads to SQS (ElasticMQ) using env-configured queue URL
- Support `GET /schedules`, `GET /schedules/:name`, and `DELETE /schedules/:name`

## Commands

```bash
npm run dev -w scheduler
npm run build -w scheduler
npm run test -w scheduler
npm run test:integration -w scheduler
npm run dev:cli -w scheduler -- create-schedule --name raffle-expire-123 --runAt 2026-06-12T04:30:00.000Z --payload '{"type":"RaffleExpiration","raffleId":"123"}'
```

## Environment

- `SCHEDULER_SQS_TARGET_QUEUE_URL` (required)
- `SCHEDULER_DB_PATH` (default: `/app/data/scheduler.db`)
- `SCHEDULER_POLL_INTERVAL_MS` (default: `1000`)
- `SCHEDULER_SQS_ENDPOINT_URL` (default: `http://elasticmq:9324`)
- `SCHEDULER_WORKER_ENABLED` (default: `true`)
- `PORT` (default: `3002`)
