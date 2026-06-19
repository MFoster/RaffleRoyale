import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SchedulerConfigService } from '../config/scheduler-config.service';
import { ScheduleService } from '../schedule.service';

const INTERVAL_NAME = 'scheduler-worker-loop';

@Injectable()
export class SchedulerWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerWorkerService.name);
  private tickInFlight = false;

  constructor(
    @Inject(SchedulerConfigService) private readonly config: SchedulerConfigService,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(ScheduleService) private readonly scheduleService: ScheduleService,
  ) {}

  onModuleInit(): void {
    if (!this.config.workerEnabled) {
      this.logger.log('Scheduler worker disabled by SCHEDULER_WORKER_ENABLED=false');
      return;
    }

    const interval = setInterval(() => {
      void this.safeTick();
    }, this.config.pollIntervalMs);

    this.schedulerRegistry.addInterval(INTERVAL_NAME, interval);
    this.logger.log(`Scheduler worker running every ${this.config.pollIntervalMs}ms`);
  }

  onModuleDestroy(): void {
    try {
      this.schedulerRegistry.deleteInterval(INTERVAL_NAME);
    } catch {
      // no-op if interval was never added.
    }
  }

  private async safeTick(): Promise<void> {
    if (this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;
    try {
      await this.scheduleService.processDueSchedules();
    } catch (error) {
      const reason = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error('Scheduler worker tick failed', reason);
    } finally {
      this.tickInFlight = false;
    }
  }
}
