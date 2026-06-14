import { Module } from '@nestjs/common';
import { SchedulerCoreModule } from './scheduler-core.module';
import { ScheduleController } from './web/schedule.controller';

@Module({
  imports: [SchedulerCoreModule],
  controllers: [ScheduleController],
})
export class SchedulerApiModule {}
