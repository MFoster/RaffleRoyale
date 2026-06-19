import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import type { Schedule } from '../types/schedule.types';
import { ScheduleService } from '../schedule.service';

@Controller('schedules')
export class ScheduleController {
  constructor(@Inject(ScheduleService) private readonly scheduleService: ScheduleService) {}

  @Post()
  async createSchedule(@Body() body: unknown): Promise<Schedule> {
    return await this.scheduleService.createSchedule(body);
  }

  @Get()
  async listSchedules(): Promise<Schedule[]> {
    return await this.scheduleService.listSchedules();
  }

  @Get(':name')
  async getSchedule(@Param('name') name: string): Promise<Schedule> {
    return await this.scheduleService.getSchedule(name);
  }

  @Delete(':name')
  @HttpCode(204)
  async deleteSchedule(@Param('name') name: string): Promise<void> {
    await this.scheduleService.cancelSchedule(name);
  }
}
