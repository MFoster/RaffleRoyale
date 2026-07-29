import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BeaconService } from './beacon.service';
import { RaffleExpirationScheduler } from './raffle-expiration.scheduler';
import { RaffleLifecycleScheduler } from './raffle-lifecycle.scheduler';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';

@Module({
  imports: [AuthModule],
  controllers: [RaffleController],
  providers: [
    RaffleService,
    RaffleExpirationScheduler,
    RaffleLifecycleScheduler,
    BeaconService,
  ],
})
export class RaffleModule {}
