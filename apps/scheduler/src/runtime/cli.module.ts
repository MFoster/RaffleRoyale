import { Module } from '@nestjs/common';
import { SchedulerCliModule } from '../scheduler/scheduler-cli.module';
import { SchedulerCoreModule } from '../scheduler/scheduler-core.module';

@Module({
  imports: [SchedulerCoreModule, SchedulerCliModule],
})
export class CliModule {}
