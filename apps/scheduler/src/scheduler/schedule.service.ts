import { ConflictException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { autoDetectAndParseRequest } from './parsing/schedule-parser';
import { ScheduleRepository } from './persistence/schedule.repository';
import { SchedulerSqsService } from './sqs/scheduler-sqs.service';
import type { Schedule } from './types/schedule.types';
import { SchedulerConfigService } from './config/scheduler-config.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @Inject(SchedulerConfigService) private readonly config: SchedulerConfigService,
    @Inject(ScheduleRepository) private readonly repository: ScheduleRepository,
    @Inject(SchedulerSqsService) private readonly sqs: SchedulerSqsService,
  ) {}

  async createSchedule(body: unknown): Promise<Schedule> {
    if (!this.config.sqsTargetQueueUrl) {
      throw new InternalServerErrorException(
        'SCHEDULER_SQS_TARGET_QUEUE_URL environment variable is required',
      );
    }

    const parsed = autoDetectAndParseRequest(body);
    const now = new Date().toISOString();
    const schedule: Schedule = {
      id: randomUUID(),
      name: parsed.name,
      runAt: parsed.runAt,
      payload: parsed.payload,
      targetQueueUrl: this.config.sqsTargetQueueUrl,
      state: 'scheduled',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.repository.create(schedule);
      return schedule;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictException(`Schedule already exists: ${schedule.name}`);
      }
      throw error;
    }
  }

  async listSchedules(): Promise<Schedule[]> {
    return await this.repository.list();
  }

  async getSchedule(name: string): Promise<Schedule> {
    const schedule = await this.repository.findByName(name);
    if (!schedule) {
      throw new NotFoundException(`Schedule not found: ${name}`);
    }
    return schedule;
  }

  async cancelSchedule(name: string): Promise<void> {
    await this.getSchedule(name);
    await this.repository.updateState(name, 'cancelled');
  }

  async processDueSchedules(): Promise<void> {
    const dueSchedules = await this.repository.findDue(new Date().toISOString());
    for (const schedule of dueSchedules) {
      await this.executeSchedule(schedule.name);
    }
  }

  async executeSchedule(name: string): Promise<void> {
    this.logger.log(`Attempting to execute schedule: ${name}`);
    const schedule = await this.repository.findByName(name);
    if (!schedule) {
      return;
    }

    if (schedule.state === 'completed') {
      return;
    }

    const claimed = await this.repository.updateStateIfCurrent(name, 'scheduled', 'running');
    if (!claimed) {
      return;
    }

    try {
      await this.sqs.sendMessage(schedule.targetQueueUrl, schedule.payload);
      await this.repository.updateStateIfCurrent(name, 'running', 'completed');
    } catch (error) {
      await this.repository.updateStateIfCurrent(name, 'running', 'failed');
      this.logger.error(`Failed to execute schedule ${name}`, error as Error);
    }
  }
}
