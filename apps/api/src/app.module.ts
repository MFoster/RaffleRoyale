import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RaffleModule } from './raffle/raffle.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    UserModule,
    AuthModule,
    RaffleModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
