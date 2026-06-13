import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RaffleLifecycleScheduler } from './raffle-lifecycle.scheduler';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';

@Module({
  imports: [AuthModule],
  controllers: [RaffleController],
  providers: [RaffleService, RaffleLifecycleScheduler],
})
export class RaffleModule {}
