import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CreateQueueCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SchedulerConfigService } from '../config/scheduler-config.service';
import { ScheduleRepository } from '../persistence/schedule.repository';
import { ScheduleService } from '../schedule.service';
import { SchedulerSqsService } from '../sqs/scheduler-sqs.service';

const runIntegration = process.env.RUN_SCHEDULER_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('ElasticMQ integration', () => {
  let tempDir: string;
  let repository: ScheduleRepository;
  let scheduleService: ScheduleService;
  let queueUrl: string;
  let sqsClient: SQSClient;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-elasticmq-'));
    queueUrl = process.env.SCHEDULER_SQS_TARGET_QUEUE_URL ?? 'http://localhost:9324/queue/raffle-events';

    const endpoint = process.env.SCHEDULER_SQS_ENDPOINT_URL ?? 'http://localhost:9324';
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? 'x';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? 'x';

    sqsClient = new SQSClient({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const queueName = queueUrl.split('/').pop() || 'raffle-events';
    const createQueueResult = await sqsClient.send(new CreateQueueCommand({ QueueName: queueName }));
    if (createQueueResult.QueueUrl) {
      queueUrl = createQueueResult.QueueUrl;
    }

    const config = {
      dbPath: join(tempDir, 'scheduler.db'),
      sqsTargetQueueUrl: queueUrl,
      sqsEndpointUrl: endpoint,
      region,
      accessKeyId,
      secretAccessKey,
    } as SchedulerConfigService;

    repository = new ScheduleRepository(config);
    await repository.onModuleInit();
    const sqsService = new SchedulerSqsService(config);
    scheduleService = new ScheduleService(config, repository, sqsService);

  });

  afterAll(async () => {
    await repository.onModuleDestroy();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('sends due schedules to ElasticMQ', async () => {
    const uniqueName = `integration-${Date.now()}`;
    const runAt = new Date(Date.now() - 10_000).toISOString();

    await scheduleService.createSchedule({
      name: uniqueName,
      runAt,
      payload: { type: 'RaffleExpiration', raffleId: 'integration-1' },
    });

    await scheduleService.processDueSchedules();

    const message = await waitForMessage(queueUrl, sqsClient);
    expect(message?.Body).toContain('"type":"RaffleExpiration"');
    expect(message?.Body).toContain('"raffleId":"integration-1"');
  });
});

async function waitForMessage(queueUrl: string, sqsClient: SQSClient) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const result = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 1,
      }),
    );

    if (result.Messages?.[0]) {
      return result.Messages[0];
    }
  }

  throw new Error('Timed out waiting for message in ElasticMQ queue');
}
