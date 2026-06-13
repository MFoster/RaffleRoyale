import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ScheduleService } from '../schedule.service';
import { ScheduleController } from './schedule.controller';

describe('ScheduleController', () => {
  let app: INestApplication;
  const scheduleService = {
    createSchedule: jest.fn(),
    listSchedules: jest.fn(),
    getSchedule: jest.fn(),
    cancelSchedule: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [{ provide: ScheduleService, useValue: scheduleService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('creates schedules', async () => {
    scheduleService.createSchedule.mockResolvedValue({ name: 'raffle-expire-123', state: 'scheduled' });

    await request(app.getHttpServer())
      .post('/schedules')
      .send({
        Name: 'raffle-expire-123',
        ScheduleExpression: 'at(2026-06-12T04:30:00Z)',
        Target: { Input: '{"type":"RaffleExpiration","raffleId":"123"}' },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.name).toBe('raffle-expire-123');
      });
  });

  it('lists schedules', async () => {
    scheduleService.listSchedules.mockResolvedValue([{ name: 'raffle-expire-123' }]);

    await request(app.getHttpServer())
      .get('/schedules')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
      });
  });

  it('deletes schedules', async () => {
    scheduleService.cancelSchedule.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/schedules/raffle-expire-123').expect(204);
    expect(scheduleService.cancelSchedule).toHaveBeenCalledWith('raffle-expire-123');
  });
});
