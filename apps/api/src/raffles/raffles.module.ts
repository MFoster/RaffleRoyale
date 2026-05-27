import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RafflesController } from './raffles.controller';
import { RafflesService } from './raffles.service';

@Module({
  imports: [AuthModule],
  controllers: [RafflesController],
  providers: [RafflesService],
})
export class RafflesModule {}
