import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RafflesModule } from './raffles/raffles.module';

@Module({
  imports: [PrismaModule, RafflesModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
