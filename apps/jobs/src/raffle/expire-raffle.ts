import {
  Prisma,
  type PrismaClient,
  RaffleStatus,
  TransactionStatus,
} from "@prisma/client";

export type ExpireRaffleResult =
  | "missing"
  | "not-active"
  | "sold-out"
  | "expired"
  | "disbanded";

export async function expireRaffle(
  prisma: PrismaClient,
  raffleId: string,
  now = new Date(),
): Promise<ExpireRaffleResult> {
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
      );
      if (lockRows.length === 0) {
        return "missing";
      }

      const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
      if (!raffle) {
        return "missing";
      }

      if (raffle.status !== RaffleStatus.ACTIVE) {
        return "not-active";
      }

      if (raffle.endTime.getTime() > now.getTime()) {
        throw new Error(
          `Raffle ${raffleId} is not due to expire until ${raffle.endTime.toISOString()}.`,
        );
      }

      if (raffle.ticketsSold >= raffle.totalTickets) {
        await tx.raffle.update({
          where: { id: raffleId },
          data: { status: RaffleStatus.SOLD_OUT },
        });
        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: "SOLD_OUT",
            metadata: {
              ticketsSold: raffle.ticketsSold,
              totalTickets: raffle.totalTickets,
              repairedBy: "expire-raffle",
            },
          },
        });
        return "sold-out";
      }

      const sellThroughPercent =
        raffle.totalTickets === 0
          ? 0
          : (raffle.ticketsSold / raffle.totalTickets) * 100;
      const meetsMinSellThrough =
        raffle.minSellThrough !== null &&
        sellThroughPercent >= raffle.minSellThrough;

      await tx.raffleEvent.create({
        data: {
          raffleId,
          eventType: "EXPIRED",
          metadata: {
            endTime: raffle.endTime.toISOString(),
            ticketsSold: raffle.ticketsSold,
            totalTickets: raffle.totalTickets,
            sellThroughPercent,
            minSellThrough: raffle.minSellThrough,
          },
        },
      });

      if (meetsMinSellThrough) {
        await tx.raffle.update({
          where: { id: raffleId },
          data: { status: RaffleStatus.EXPIRED },
        });
        return "expired";
      }

      const refundResult = await tx.transaction.updateMany({
        where: {
          raffleId,
          status: TransactionStatus.SUCCEEDED,
        },
        data: {
          status: TransactionStatus.REFUNDED,
        },
      });

      await tx.raffle.update({
        where: { id: raffleId },
        data: { status: RaffleStatus.DISBANDED },
      });
      await tx.raffleEvent.create({
        data: {
          raffleId,
          eventType: "DISBANDED",
          metadata: {
            refundedTransactions: refundResult.count,
            sellThroughPercent,
            minSellThrough: raffle.minSellThrough,
          },
        },
      });

      return "disbanded";
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
