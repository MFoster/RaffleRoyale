import { ConflictException } from '@nestjs/common';
import { SchedulerConfigService } from './config/scheduler-config.service';
import { ScheduleRepository } from './persistence/schedule.repository';
import { ScheduleService } from './schedule.service';
import { SchedulerSqsService } from './sqs/scheduler-sqs.service';
import type { Schedule } from './types/schedule.types';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let repository: jest.Mocked<ScheduleRepository>;
  let sqs: jest.Mocked<SchedulerSqsService>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      findByName: jest.fn(),
      findDue: jest.fn().mockResolvedValue([]),
      updateState: jest.fn(),
      updateStateIfCurrent: jest.fn().mockResolvedValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<ScheduleRepository>;

    sqs = {
      sendMessage: jest.fn().mockResolvedValue('msg-1'),
    } as unknown as jest.Mocked<SchedulerSqsService>;

    const config = {
      sqsTargetQueueUrl: 'http://elasticmq:9324/000000000000/raffle-events',
    } as SchedulerConfigService;

    service = new ScheduleService(config, repository, sqs);
  });

  it('creates EventBridge-format schedule', async () => {
    const created = await service.createSchedule({
      Name: 'raffle-expire-123',
      ScheduleExpression: 'at(2026-06-12T04:30:00Z)',
      Target: { Input: '{"type":"RaffleExpiration","raffleId":"123"}' },
    });

    expect(created.name).toBe('raffle-expire-123');
    expect(created.state).toBe('scheduled');
    expect(repository.create).toHaveBeenCalled();
  });

  it('throws conflict on duplicate schedule name', async () => {
    repository.create.mockRejectedValue(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: schedules.name'));

    await expect(
      service.createSchedule({
        name: 'raffle-expire-123',
        runAt: '2026-06-12T04:30:00.000Z',
        payload: { type: 'RaffleExpiration', raffleId: '123' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('executes due schedules idempotently', async () => {
    const schedule: Schedule = {
      id: 'id-1',
      name: 'raffle-expire-123',
      runAt: '2026-06-12T04:30:00.000Z',
      payload: { type: 'RaffleExpiration', raffleId: '123' },
      targetQueueUrl: 'http://elasticmq:9324/000000000000/raffle-events',
      state: 'scheduled',
      createdAt: '2026-06-12T03:00:00.000Z',
      updatedAt: '2026-06-12T03:00:00.000Z',
    };

    repository.findByName.mockResolvedValue(schedule);
    repository.findDue.mockResolvedValue([schedule]);

    await service.processDueSchedules();

    expect(repository.updateStateIfCurrent).toHaveBeenCalledWith(
      'raffle-expire-123',
      'scheduled',
      'running',
    );
    expect(sqs.sendMessage).toHaveBeenCalledWith(schedule.targetQueueUrl, schedule.payload);
    expect(repository.updateStateIfCurrent).toHaveBeenCalledWith(
      'raffle-expire-123',
      'running',
      'completed',
    );
  });
});
