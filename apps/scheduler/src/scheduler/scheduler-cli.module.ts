import { Module } from '@nestjs/common';
import { SchedulerCoreModule } from './scheduler-core.module';
import { CreateScheduleCommand } from './cli/create-schedule.command';

@Module({
  imports: [SchedulerCoreModule],
  providers: [CreateScheduleCommand],
})
export class SchedulerCliModule {}
