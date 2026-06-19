import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ScheduleService } from '../schedule.service';

interface CreateScheduleOptions {
  name: string;
  runAt: string;
  payload: string;
}

@Injectable()
@Command({
  name: 'create-schedule',
  description: 'Manually create a local-format schedule from the CLI',
})
export class CreateScheduleCommand extends CommandRunner {
  constructor(@Inject(ScheduleService) private readonly scheduleService: ScheduleService) {
    super();
  }

  async run(_: string[], options: CreateScheduleOptions): Promise<void> {
    if (!options.name || !options.runAt || !options.payload) {
      throw new BadRequestException('Options --name, --runAt, and --payload are all required');
    }

    const payload = this.parsePayload(options.payload);
    const created = await this.scheduleService.createSchedule({
      name: options.name,
      runAt: options.runAt,
      payload,
    });

    process.stdout.write(`${JSON.stringify(created)}\n`);
  }

  @Option({
    flags: '-n, --name [name]',
    description: 'Schedule name (unique)',
  })
  parseName(value: string): string {
    return value;
  }

  @Option({
    flags: '-r, --runAt [runAt]',
    description: 'ISO timestamp when schedule should execute',
  })
  parseRunAt(value: string): string {
    return value;
  }

  @Option({
    flags: '-p, --payload [payload]',
    description: 'JSON payload to send to SQS',
  })
  parsePayloadOption(value: string): string {
    return value;
  }

  private parsePayload(payloadValue: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(payloadValue) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new BadRequestException('--payload must parse to a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('--payload must be valid JSON');
    }
  }
}
