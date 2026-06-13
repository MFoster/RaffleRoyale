import { SchedulerRegistry } from '@nestjs/schedule';
import { SchedulerConfigService } from '../config/scheduler-config.service';
import { ScheduleService } from '../schedule.service';
import { SchedulerWorkerService } from './scheduler-worker.service';

describe('SchedulerWorkerService', () => {
  it('registers interval and processes due schedules', async () => {
    jest.useFakeTimers();
    const intervals = new Map<string, NodeJS.Timeout>();
    const schedulerRegistry = {
      addInterval: jest.fn((name: string, interval: NodeJS.Timeout) => intervals.set(name, interval)),
      deleteInterval: jest.fn((name: string) => {
        const interval = intervals.get(name);
        if (!interval) {
          throw new Error('missing');
        }
        clearInterval(interval);
      }),
    } as unknown as SchedulerRegistry;

    const scheduleService = {
      processDueSchedules: jest.fn().mockResolvedValue(undefined),
    } as unknown as ScheduleService;

    const config = {
      pollIntervalMs: 100,
      workerEnabled: true,
    } as SchedulerConfigService;

    const worker = new SchedulerWorkerService(config, schedulerRegistry, scheduleService);
    worker.onModuleInit();

    jest.advanceTimersByTime(250);
    await Promise.resolve();

    expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
    expect(scheduleService.processDueSchedules).toHaveBeenCalled();

    worker.onModuleDestroy();
    jest.useRealTimers();
  });
});
