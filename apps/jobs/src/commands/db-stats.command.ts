import type { JobCommand } from './types';

export const dbStatsCommand: JobCommand = {
  name: 'db:stats',
  description: 'Show high-level row counts for core raffle tables.',
  async run({ prisma }) {
    const [users, raffles, tickets, transactions, payouts, raffleEvents] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.raffle.count(),
        prisma.ticket.count(),
        prisma.transaction.count(),
        prisma.payout.count(),
        prisma.raffleEvent.count(),
      ]);

    console.table([
      { resource: 'users', count: users },
      { resource: 'raffles', count: raffles },
      { resource: 'tickets', count: tickets },
      { resource: 'transactions', count: transactions },
      { resource: 'payouts', count: payouts },
      { resource: 'raffle_events', count: raffleEvents },
    ]);
  },
};
