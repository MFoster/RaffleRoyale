import { Prisma, RaffleStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';
import type { JobCommand } from './types';

type SweepSummary = {
  scanned: number;
  resolved: number;
  skippedNoTickets: number;
  skippedNotEligible: number;
  skippedAlreadyResolved: number;
};

export const sweepCommand: JobCommand = {
  name: 'sweep',
  description:
    'Resolve winners for eligible raffles missing WINNER_SELECTED and finish lifecycle state.',
  async run({ prisma }) {
    const candidates = await prisma.raffle.findMany({
      where: {
        status: {
          in: [RaffleStatus.SOLD_OUT, RaffleStatus.EXPIRED, RaffleStatus.COMPLETED],
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const summary: SweepSummary = {
      scanned: candidates.length,
      resolved: 0,
      skippedNoTickets: 0,
      skippedNotEligible: 0,
      skippedAlreadyResolved: 0,
    };

    for (const candidate of candidates) {
      const result = await prisma.$transaction(
        async (tx) => {
          const lockRows = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM raffles WHERE id = ${candidate.id} FOR UPDATE`,
          );

          if (lockRows.length === 0) {
            return { action: 'skip-not-eligible' as const };
          }

          const raffle = await tx.raffle.findUnique({
            where: { id: candidate.id },
            select: {
              id: true,
              status: true,
              totalTickets: true,
              ticketsSold: true,
              minSellThrough: true,
            },
          });

          if (!raffle) {
            return { action: 'skip-not-eligible' as const };
          }

          const existingWinner = await tx.raffleEvent.findFirst({
            where: {
              raffleId: raffle.id,
              eventType: 'WINNER_SELECTED',
            },
            select: {
              id: true,
            },
          });

          if (existingWinner) {
            return { action: 'skip-already-resolved' as const };
          }

          const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
          const isExpired = raffle.status === RaffleStatus.EXPIRED;
          const isCompleted = raffle.status === RaffleStatus.COMPLETED;

          const expiredEligible = (() => {
            if (!isExpired) {
              return false;
            }

            const sellThroughPercent =
              raffle.totalTickets === 0
                ? 0
                : (raffle.ticketsSold / raffle.totalTickets) * 100;

            return (
              raffle.minSellThrough !== null &&
              sellThroughPercent >= raffle.minSellThrough
            );
          })();

          if (!isSoldOut && !expiredEligible && !isCompleted) {
            return { action: 'skip-not-eligible' as const };
          }

          const ticketCount = await tx.ticket.count({ where: { raffleId: raffle.id } });

          if (ticketCount <= 0) {
            return { action: 'skip-no-tickets' as const };
          }

          const randomIndex = randomInt(0, ticketCount);
          const winnerTicket = await tx.ticket.findFirst({
            where: { raffleId: raffle.id },
            orderBy: { ticketNumber: 'asc' },
            skip: randomIndex,
          });

          if (!winnerTicket) {
            return { action: 'skip-no-tickets' as const };
          }

          if (!isCompleted) {
            await tx.raffle.update({
              where: { id: raffle.id },
              data: { status: RaffleStatus.COMPLETED },
            });
          }

          await tx.raffleEvent.create({
            data: {
              raffleId: raffle.id,
              eventType: 'WINNER_SELECTED',
              winnerTicketId: winnerTicket.id,
              metadata: {
                winnerTicketId: winnerTicket.id,
                winnerTicketNumber: winnerTicket.ticketNumber,
                ticketCount,
                randomIndex,
                algorithm: 'crypto.randomInt-v1',
                source: 'jobs-sweep-v1',
              },
            },
          });

          return {
            action: 'resolved' as const,
            raffleId: raffle.id,
            winnerTicketNumber: winnerTicket.ticketNumber,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (result.action === 'resolved') {
        summary.resolved += 1;
        console.log(
          `Resolved winner for raffle ${result.raffleId} (ticket #${String(result.winnerTicketNumber)}).`,
        );
        continue;
      }

      if (result.action === 'skip-no-tickets') {
        summary.skippedNoTickets += 1;
        continue;
      }

      if (result.action === 'skip-already-resolved') {
        summary.skippedAlreadyResolved += 1;
        continue;
      }

      summary.skippedNotEligible += 1;
    }

    console.table([
      {
        scanned: summary.scanned,
        resolved: summary.resolved,
        skippedNoTickets: summary.skippedNoTickets,
        skippedNotEligible: summary.skippedNotEligible,
        skippedAlreadyResolved: summary.skippedAlreadyResolved,
      },
    ]);
  },
};