import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './runtime/app.module';
import { SchedulerConfigService } from './scheduler/config/scheduler-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(SchedulerConfigService);
  const logger = new Logger('SchedulerBootstrap');

  await app.listen(config.port);
  logger.log(`Scheduler HTTP API listening on port ${config.port}`);
}

void bootstrap();
