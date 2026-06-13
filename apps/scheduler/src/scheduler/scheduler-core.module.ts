import { Module } from '@nestjs/common';
import { SchedulerConfigService } from './config/scheduler-config.service';
import { ScheduleRepository } from './persistence/schedule.repository';
import { SchedulerSqsService } from './sqs/scheduler-sqs.service';
import { ScheduleService } from './schedule.service';

@Module({
  providers: [SchedulerConfigService, ScheduleRepository, SchedulerSqsService, ScheduleService],
  exports: [SchedulerConfigService, ScheduleRepository, SchedulerSqsService, ScheduleService],
})
export class SchedulerCoreModule {}
