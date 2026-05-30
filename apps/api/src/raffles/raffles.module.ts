import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RaffleLifecycleScheduler } from './raffle-lifecycle.scheduler';
import { RafflesController } from './raffles.controller';
import { RafflesService } from './raffles.service';

@Module({
  imports: [AuthModule],
  controllers: [RafflesController],
  providers: [RafflesService, RaffleLifecycleScheduler],
})
export class RafflesModule {}
