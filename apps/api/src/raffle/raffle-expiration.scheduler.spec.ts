import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  type CreateScheduleInput,
} from '@aws-sdk/client-scheduler';
import { parseAndVerifyQueueMessage } from '@raffleroyale/queue-signature';
import { RaffleExpirationScheduler } from './raffle-expiration.scheduler';

type SchedulerCommand = CreateScheduleCommand | DeleteScheduleCommand;

let sentCommand: SchedulerCommand | undefined;
const schedulerSend = (command: SchedulerCommand): Promise<unknown> => {
  sentCommand = command;
  return Promise.resolve({});
};
const mockSchedulerSend = jest.fn(schedulerSend);

jest.mock('@aws-sdk/client-scheduler', () => {
  const actual = jest.requireActual<typeof import('@aws-sdk/client-scheduler')>(
    '@aws-sdk/client-scheduler',
  );
  return {
    ...actual,
    SchedulerClient: jest
      .fn()
      .mockImplementation((): { send: typeof mockSchedulerSend } => ({
        send: mockSchedulerSend,
      })),
  };
});

describe('RaffleExpirationScheduler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      RAFFLE_EVENTBRIDGE_SCHEDULER_ENABLED: 'true',
      EVENTBRIDGE_SCHEDULER_GROUP_NAME: 'raffle-royale-nonprod',
      EVENTBRIDGE_SCHEDULER_ROLE_ARN:
        'arn:aws:iam::123456789012:role/scheduler-role',
      JOBS_SQS_QUEUE_ARN:
        'arn:aws:sqs:us-east-1:123456789012:raffle-royale-jobs',
      QUEUE_MESSAGE_SIGNING_KEY: 'test-signing-key',
    };
    sentCommand = undefined;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates an auto-deleting one-time schedule with a signed job', async () => {
    const scheduler = new RaffleExpirationScheduler();
    const endTime = new Date('2026-08-01T12:34:56.789Z');

    await expect(
      scheduler.createExpirationSchedule('raffle-1', endTime),
    ).resolves.toBe(true);

    const command = sentCommand;
    if (!(command instanceof CreateScheduleCommand)) {
      throw new Error('Expected CreateScheduleCommand');
    }
    const createInput: CreateScheduleInput = command.input;
    expect(createInput.Name).toBe('raffle-expiration-raffle-1');
    expect(createInput.GroupName).toBe('raffle-royale-nonprod');
    expect(createInput.ScheduleExpression).toBe('at(2026-08-01T12:34:56)');
    expect(createInput.FlexibleTimeWindow).toEqual({ Mode: 'OFF' });
    expect(createInput.ActionAfterCompletion).toBe('DELETE');
    expect(createInput.Target?.Arn).toBe(process.env.JOBS_SQS_QUEUE_ARN);
    expect(createInput.Target?.RoleArn).toBe(
      process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN,
    );

    const targetInput = createInput.Target?.Input;
    if (!targetInput) {
      throw new Error('Expected schedule target input');
    }
    expect(parseAndVerifyQueueMessage(targetInput, 'test-signing-key')).toEqual(
      {
        id: 'raffle-expiration:raffle-1',
        command: 'expire-raffle',
        args: ['raffle-1'],
      },
    );
  });

  it('deletes the deterministic schedule during compensation', async () => {
    const scheduler = new RaffleExpirationScheduler();

    await scheduler.deleteExpirationSchedule('raffle-1');

    const command = sentCommand;
    if (!(command instanceof DeleteScheduleCommand)) {
      throw new Error('Expected DeleteScheduleCommand');
    }
    expect(command.input).toEqual({
      Name: 'raffle-expiration-raffle-1',
      GroupName: 'raffle-royale-nonprod',
    });
  });

  it('does not call AWS when scheduling is disabled', async () => {
    process.env.RAFFLE_EVENTBRIDGE_SCHEDULER_ENABLED = 'false';
    const scheduler = new RaffleExpirationScheduler();

    await expect(
      scheduler.createExpirationSchedule(
        'raffle-1',
        new Date('2026-08-01T12:34:56Z'),
      ),
    ).resolves.toBe(false);
    expect(mockSchedulerSend).not.toHaveBeenCalled();
  });
});
