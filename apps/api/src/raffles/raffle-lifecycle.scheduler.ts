import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RafflesService } from './raffles.service';

@Injectable()
export class RaffleLifecycleScheduler {
  private readonly logger = new Logger(RaffleLifecycleScheduler.name);

  constructor(private readonly rafflesService: RafflesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredRaffles(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (process.env.RAFFLE_EXPIRATION_CRON_ENABLED === 'false') {
      return;
    }

    try {
      const result = await this.rafflesService.processExpiredRaffles();

      if (result.processed > 0) {
        this.logger.log(
          `Processed ${result.processed} expired raffles (disbanded=${result.disbanded}, thresholdMet=${result.markedExpiredThresholdMet}).`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed processing expired raffles: ${message}`);
    }
  }
}
