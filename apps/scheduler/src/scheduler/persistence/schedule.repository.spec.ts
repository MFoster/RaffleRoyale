import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SchedulerConfigService } from '../config/scheduler-config.service';
import { ScheduleRepository } from './schedule.repository';
import type { Schedule } from '../types/schedule.types';

describe('ScheduleRepository', () => {
  let repository: ScheduleRepository;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-repo-'));
    const config = {
      dbPath: join(tempDir, 'scheduler.db'),
    } as SchedulerConfigService;
    repository = new ScheduleRepository(config);
    await repository.onModuleInit();
  });

  afterEach(async () => {
    await repository.onModuleDestroy();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates and retrieves a schedule', async () => {
    const schedule: Schedule = {
      id: 'id-1',
      name: 'raffle-expire-123',
      runAt: '2026-06-12T04:30:00.000Z',
      payload: { type: 'RaffleExpiration', raffleId: '123' },
      targetQueueUrl: 'http://elasticmq:9324/000000000000/raffle-events',
      state: 'scheduled',
      createdAt: '2026-06-12T04:00:00.000Z',
      updatedAt: '2026-06-12T04:00:00.000Z',
    };

    await repository.create(schedule);
    const found = await repository.findByName('raffle-expire-123');

    expect(found).toEqual(schedule);
  });

  it('returns only due scheduled items', async () => {
    const now = new Date('2026-06-12T05:00:00.000Z').toISOString();

    await repository.create({
      id: 'past',
      name: 'past',
      runAt: '2026-06-12T04:00:00.000Z',
      payload: { type: 'RaffleExpiration' },
      targetQueueUrl: 'q',
      state: 'scheduled',
      createdAt: now,
      updatedAt: now,
    });
    await repository.create({
      id: 'future',
      name: 'future',
      runAt: '2026-06-12T06:00:00.000Z',
      payload: { type: 'RaffleExpiration' },
      targetQueueUrl: 'q',
      state: 'scheduled',
      createdAt: now,
      updatedAt: now,
    });
    await repository.create({
      id: 'completed',
      name: 'completed',
      runAt: '2026-06-12T04:00:00.000Z',
      payload: { type: 'RaffleExpiration' },
      targetQueueUrl: 'q',
      state: 'completed',
      createdAt: now,
      updatedAt: now,
    });

    const due = await repository.findDue(now);
    expect(due.map((item) => item.name)).toEqual(['past']);
  });
});
