import { Module } from '@nestjs/common';
import { SchedulerCoreModule } from './scheduler-core.module';
import { SchedulerWorkerService } from './worker/scheduler-worker.service';

@Module({
  imports: [SchedulerCoreModule],
  providers: [SchedulerWorkerService],
})
export class SchedulerWorkerModule {}
