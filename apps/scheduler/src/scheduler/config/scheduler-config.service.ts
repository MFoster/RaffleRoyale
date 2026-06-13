import { Injectable } from '@nestjs/common';

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

@Injectable()
export class SchedulerConfigService {
  readonly dbPath = process.env.SCHEDULER_DB_PATH ?? '/app/data/scheduler.db';
  readonly sqsTargetQueueUrl = process.env.SCHEDULER_SQS_TARGET_QUEUE_URL ?? '';
  readonly sqsEndpointUrl = process.env.SCHEDULER_SQS_ENDPOINT_URL ?? 'http://elasticmq:9324';
  readonly pollIntervalMs = parseNumber(process.env.SCHEDULER_POLL_INTERVAL_MS, 1000);
  readonly port = parseNumber(process.env.PORT, 3002);
  readonly workerEnabled = process.env.SCHEDULER_WORKER_ENABLED !== 'false';
  readonly region = process.env.AWS_REGION ?? 'us-east-1';
  readonly accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? 'x';
  readonly secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? 'x';
}
