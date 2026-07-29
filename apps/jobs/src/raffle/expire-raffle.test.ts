import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type PrismaClient,
  RaffleStatus,
  TransactionStatus,
} from '@prisma/client';
import { expireRaffle } from './expire-raffle';

function createPrismaMock(raffle: {
  id: string;
  status: RaffleStatus;
  endTime: Date;
  totalTickets: number;
  ticketsSold: number;
  minSellThrough: number | null;
}): {
  prisma: PrismaClient;
  updates: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  refunds: Array<Record<string, unknown>>;
} {
  const updates: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const refunds: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: () => Promise.resolve([{ id: raffle.id }]),
    raffle: {
      findUnique: () => Promise.resolve(raffle),
      update: (input: Record<string, unknown>) => {
        updates.push(input);
        return Promise.resolve(raffle);
      },
    },
    raffleEvent: {
      create: (input: Record<string, unknown>) => {
        events.push(input);
        return Promise.resolve(input);
      },
    },
    transaction: {
      updateMany: (input: Record<string, unknown>) => {
        refunds.push(input);
        return Promise.resolve({ count: 2 });
      },
    },
  };
  const prisma = {
    $transaction: (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  } as unknown as PrismaClient;

  return { prisma, updates, events, refunds };
}

void test('marks a threshold-meeting raffle expired exactly once', async () => {
  const { prisma, updates, events, refunds } = createPrismaMock({
    id: 'raffle-1',
    status: RaffleStatus.ACTIVE,
    endTime: new Date('2026-08-01T00:00:00Z'),
    totalTickets: 10,
    ticketsSold: 6,
    minSellThrough: 50,
  });

  const result = await expireRaffle(
    prisma,
    'raffle-1',
    new Date('2026-08-01T00:01:00Z'),
  );

  assert.equal(result, 'expired');
  assert.deepEqual(updates[0], {
    where: { id: 'raffle-1' },
    data: { status: RaffleStatus.EXPIRED },
  });
  assert.equal(events.length, 1);
  assert.equal(refunds.length, 0);
});

void test('disbands an under-threshold raffle and refunds successful transactions', async () => {
  const { prisma, updates, events, refunds } = createPrismaMock({
    id: 'raffle-1',
    status: RaffleStatus.ACTIVE,
    endTime: new Date('2026-08-01T00:00:00Z'),
    totalTickets: 10,
    ticketsSold: 2,
    minSellThrough: 50,
  });

  const result = await expireRaffle(
    prisma,
    'raffle-1',
    new Date('2026-08-01T00:01:00Z'),
  );

  assert.equal(result, 'disbanded');
  assert.deepEqual(refunds[0], {
    where: {
      raffleId: 'raffle-1',
      status: TransactionStatus.SUCCEEDED,
    },
    data: { status: TransactionStatus.REFUNDED },
  });
  assert.deepEqual(updates.at(-1), {
    where: { id: 'raffle-1' },
    data: { status: RaffleStatus.DISBANDED },
  });
  assert.deepEqual(
    events.map((event) => {
      const data = event.data as { eventType: string };
      return data.eventType;
    }),
    ['EXPIRED', 'DISBANDED'],
  );
});

void test('treats repeated delivery for a non-active raffle as a no-op', async () => {
  const { prisma, updates, events, refunds } = createPrismaMock({
    id: 'raffle-1',
    status: RaffleStatus.DISBANDED,
    endTime: new Date('2026-08-01T00:00:00Z'),
    totalTickets: 10,
    ticketsSold: 2,
    minSellThrough: 50,
  });

  const result = await expireRaffle(
    prisma,
    'raffle-1',
    new Date('2026-08-01T00:01:00Z'),
  );

  assert.equal(result, 'not-active');
  assert.equal(updates.length, 0);
  assert.equal(events.length, 0);
  assert.equal(refunds.length, 0);
});
