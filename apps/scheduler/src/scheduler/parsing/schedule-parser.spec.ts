import { BadRequestException } from '@nestjs/common';
import { autoDetectAndParseRequest, parseScheduleExpression } from './schedule-parser';

describe('schedule-parser', () => {
  describe('parseScheduleExpression', () => {
    it('parses EventBridge at() expressions', () => {
      expect(parseScheduleExpression('at(2026-06-12T04:30:00Z)')).toBe('2026-06-12T04:30:00.000Z');
    });

    it('throws for non-at() expressions', () => {
      expect(() => parseScheduleExpression('rate(5 minutes)')).toThrow(BadRequestException);
    });
  });

  describe('autoDetectAndParseRequest', () => {
    it('supports EventBridge request format', () => {
      const parsed = autoDetectAndParseRequest({
        Name: 'raffle-expire-123',
        ScheduleExpression: 'at(2026-06-12T04:30:00Z)',
        Target: {
          Input: '{"type":"RaffleExpiration","raffleId":"123"}',
        },
      });

      expect(parsed).toEqual({
        name: 'raffle-expire-123',
        runAt: '2026-06-12T04:30:00.000Z',
        payload: { type: 'RaffleExpiration', raffleId: '123' },
      });
    });

    it('supports local request format', () => {
      const parsed = autoDetectAndParseRequest({
        name: 'raffle-expire-456',
        runAt: '2026-06-12T04:30:00.000Z',
        payload: { type: 'RaffleExpiration', raffleId: '456' },
      });

      expect(parsed).toEqual({
        name: 'raffle-expire-456',
        runAt: '2026-06-12T04:30:00.000Z',
        payload: { type: 'RaffleExpiration', raffleId: '456' },
      });
    });
  });
});
