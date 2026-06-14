import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerApiModule } from '../scheduler/scheduler-api.module';
import { SchedulerCoreModule } from '../scheduler/scheduler-core.module';
import { SchedulerWorkerModule } from '../scheduler/scheduler-worker.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SchedulerCoreModule,
    SchedulerApiModule,
    SchedulerWorkerModule,
  ],
})
export class AppModule {}
