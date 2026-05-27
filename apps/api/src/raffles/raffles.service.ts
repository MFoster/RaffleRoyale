import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemType,
  Prisma,
  Raffle,
  RaffleEvent,
  RaffleStatus,
  TransactionStatus,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';

type PurchaseTicketsResult = {
  raffleId: string;
  transactionId: string;
  quantity: number;
  ticketNumbers: number[];
  totalAmount: number;
  raffleStatus: RaffleStatus;
};

type ResolveWinnerResult = {
  raffleId: string;
  winnerTicketId: string;
  winnerTicketNumber: number;
  ticketCount: number;
  randomIndex: number;
  raffleStatus: RaffleStatus;
};

type DisbandRaffleResult = {
  raffleId: string;
  raffleStatus: RaffleStatus;
  refundedTransactions: number;
  sellThroughPercent: number;
};

type ProcessExpiredRafflesResult = {
  processed: number;
  disbanded: number;
  markedExpiredThresholdMet: number;
};

const VALID_CREATE_STATUSES = new Set<RaffleStatus>([
  RaffleStatus.DRAFT,
  RaffleStatus.ACTIVE,
]);

@Injectable()
export class RafflesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRaffleDto: CreateRaffleDto): Promise<Raffle> {
    const endTime = new Date(createRaffleDto.endTime);
    if (endTime.getTime() <= Date.now()) {
      throw new BadRequestException('endTime must be in the future');
    }

    const raffler = await this.prisma.user.findUnique({
      where: { id: createRaffleDto.rafflerId },
      select: { id: true },
    });

    if (!raffler) {
      throw new BadRequestException('rafflerId does not exist');
    }

    const status = createRaffleDto.status ?? RaffleStatus.DRAFT;
    if (!VALID_CREATE_STATUSES.has(status)) {
      throw new BadRequestException(
        'Only DRAFT or ACTIVE raffles can be created',
      );
    }

    const raffle = await this.prisma.raffle.create({
      data: {
        rafflerId: createRaffleDto.rafflerId,
        title: createRaffleDto.title,
        description: createRaffleDto.description,
        itemType: createRaffleDto.itemType ?? ItemType.PHYSICAL,
        totalTickets: createRaffleDto.totalTickets,
        ticketPrice: createRaffleDto.ticketPrice,
        minSellThrough: createRaffleDto.minSellThrough,
        status,
        endTime,
      },
    });

    await this.prisma.raffleEvent.create({
      data: {
        raffleId: raffle.id,
        eventType: 'CREATED',
        metadata: {
          status,
          totalTickets: raffle.totalTickets,
          ticketPrice: raffle.ticketPrice,
        },
      },
    });

    return raffle;
  }

  async findAll(): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Raffle> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
    });

    if (!raffle) {
      throw new NotFoundException(`Raffle ${id} not found`);
    }

    return raffle;
  }

  async purchaseTickets(
    raffleId: string,
    purchaseTicketsDto: PurchaseTicketsDto,
  ): Promise<PurchaseTicketsResult> {
    const purchaseResult = await this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );

        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (raffle.status !== RaffleStatus.ACTIVE) {
          throw new ConflictException('Only ACTIVE raffles can accept tickets');
        }

        if (raffle.endTime.getTime() <= Date.now()) {
          throw new ConflictException('Raffle has expired');
        }

        const buyer = await tx.user.findUnique({
          where: { id: purchaseTicketsDto.buyerId },
          select: { id: true },
        });
        if (!buyer) {
          throw new BadRequestException('buyerId does not exist');
        }

        const remainingTickets = raffle.totalTickets - raffle.ticketsSold;
        if (purchaseTicketsDto.quantity > remainingTickets) {
          throw new ConflictException('Not enough tickets remaining');
        }

        const totalAmount = purchaseTicketsDto.quantity * raffle.ticketPrice;
        const transaction = await tx.transaction.create({
          data: {
            userId: buyer.id,
            raffleId,
            amount: totalAmount,
            status: TransactionStatus.SUCCEEDED,
          },
        });

        const firstTicketNumber = raffle.ticketsSold + 1;
        const ticketNumbers = Array.from(
          { length: purchaseTicketsDto.quantity },
          (_, index) => firstTicketNumber + index,
        );

        await tx.ticket.createMany({
          data: ticketNumbers.map((ticketNumber) => ({
            raffleId,
            buyerId: buyer.id,
            transactionId: transaction.id,
            ticketNumber,
          })),
        });

        const nextTicketsSold =
          raffle.ticketsSold + purchaseTicketsDto.quantity;
        const nextStatus =
          nextTicketsSold === raffle.totalTickets
            ? RaffleStatus.SOLD_OUT
            : raffle.status;

        await tx.raffle.update({
          where: { id: raffleId },
          data: {
            ticketsSold: nextTicketsSold,
            status: nextStatus,
          },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'TICKET_PURCHASED',
            metadata: {
              buyerId: buyer.id,
              quantity: purchaseTicketsDto.quantity,
              ticketNumbers,
              transactionId: transaction.id,
              totalAmount,
            },
          },
        });

        if (nextStatus === RaffleStatus.SOLD_OUT) {
          await tx.raffleEvent.create({
            data: {
              raffleId,
              eventType: 'SOLD_OUT',
              metadata: {
                ticketsSold: nextTicketsSold,
                totalTickets: raffle.totalTickets,
              },
            },
          });
        }

        return {
          raffleId,
          transactionId: transaction.id,
          quantity: purchaseTicketsDto.quantity,
          ticketNumbers,
          totalAmount,
          raffleStatus: nextStatus,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return purchaseResult;
  }

  async findEvents(id: string): Promise<RaffleEvent[]> {
    await this.findOne(id);

    return this.prisma.raffleEvent.findMany({
      where: { raffleId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveWinner(raffleId: string): Promise<ResolveWinnerResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );

        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (raffle.status === RaffleStatus.COMPLETED) {
          throw new ConflictException('Winner has already been resolved');
        }

        if (raffle.status !== RaffleStatus.SOLD_OUT) {
          throw new ConflictException(
            'Only SOLD_OUT raffles can resolve a winner',
          );
        }

        const ticketCount = await tx.ticket.count({ where: { raffleId } });
        if (ticketCount <= 0) {
          throw new ConflictException('Cannot resolve winner with no tickets');
        }

        const randomIndex = randomInt(0, ticketCount);
        const winnerTicket = await tx.ticket.findFirst({
          where: { raffleId },
          orderBy: { ticketNumber: 'asc' },
          skip: randomIndex,
        });

        if (!winnerTicket) {
          throw new NotFoundException('Winner ticket could not be determined');
        }

        await tx.raffle.update({
          where: { id: raffleId },
          data: { status: RaffleStatus.COMPLETED },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'WINNER_SELECTED',
            metadata: {
              winnerTicketId: winnerTicket.id,
              winnerTicketNumber: winnerTicket.ticketNumber,
              ticketCount,
              randomIndex,
              algorithm: 'crypto.randomInt-v1',
            },
          },
        });

        return {
          raffleId,
          winnerTicketId: winnerTicket.id,
          winnerTicketNumber: winnerTicket.ticketNumber,
          ticketCount,
          randomIndex,
          raffleStatus: RaffleStatus.COMPLETED,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
  }

  async disbandRaffle(raffleId: string): Promise<DisbandRaffleResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );

        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (raffle.status === RaffleStatus.DISBANDED) {
          throw new ConflictException('Raffle is already disbanded');
        }

        if (raffle.status === RaffleStatus.COMPLETED) {
          throw new ConflictException('Completed raffles cannot be disbanded');
        }

        if (raffle.status === RaffleStatus.SOLD_OUT) {
          throw new ConflictException(
            'SOLD_OUT raffles must resolve a winner, not disband',
          );
        }

        if (raffle.endTime.getTime() > Date.now()) {
          throw new ConflictException('Only expired raffles can be disbanded');
        }

        const sellThroughPercent =
          raffle.totalTickets === 0
            ? 0
            : (raffle.ticketsSold / raffle.totalTickets) * 100;
        const meetsMinSellThrough =
          raffle.minSellThrough !== null &&
          sellThroughPercent >= raffle.minSellThrough;

        if (meetsMinSellThrough) {
          throw new ConflictException(
            'Raffle met minimum sell-through and should follow completion flow',
          );
        }

        if (raffle.status !== RaffleStatus.EXPIRED) {
          await tx.raffleEvent.create({
            data: {
              raffleId,
              eventType: 'EXPIRED',
              metadata: {
                endTime: raffle.endTime.toISOString(),
                ticketsSold: raffle.ticketsSold,
                totalTickets: raffle.totalTickets,
              },
            },
          });
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
            eventType: 'DISBANDED',
            metadata: {
              refundedTransactions: refundResult.count,
              sellThroughPercent,
              minSellThrough: raffle.minSellThrough,
            },
          },
        });

        return {
          raffleId,
          raffleStatus: RaffleStatus.DISBANDED,
          refundedTransactions: refundResult.count,
          sellThroughPercent,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
  }

  async processExpiredRaffles(): Promise<ProcessExpiredRafflesResult> {
    const now = new Date();
    const candidates = await this.prisma.raffle.findMany({
      where: {
        status: RaffleStatus.ACTIVE,
        endTime: {
          lte: now,
        },
      },
      select: {
        id: true,
        totalTickets: true,
        ticketsSold: true,
        minSellThrough: true,
      },
    });

    let disbanded = 0;
    let markedExpiredThresholdMet = 0;

    for (const raffle of candidates) {
      if (raffle.ticketsSold >= raffle.totalTickets) {
        continue;
      }

      const sellThroughPercent =
        raffle.totalTickets === 0
          ? 0
          : (raffle.ticketsSold / raffle.totalTickets) * 100;
      const meetsMinSellThrough =
        raffle.minSellThrough !== null &&
        sellThroughPercent >= raffle.minSellThrough;

      if (meetsMinSellThrough) {
        const updateResult = await this.prisma.raffle.updateMany({
          where: {
            id: raffle.id,
            status: RaffleStatus.ACTIVE,
            endTime: {
              lte: now,
            },
          },
          data: {
            status: RaffleStatus.EXPIRED,
          },
        });

        if (updateResult.count > 0) {
          markedExpiredThresholdMet += 1;
          await this.prisma.raffleEvent.create({
            data: {
              raffleId: raffle.id,
              eventType: 'EXPIRED',
              metadata: {
                reason: 'threshold-met-awaiting-resolution',
                sellThroughPercent,
                minSellThrough: raffle.minSellThrough,
              },
            },
          });
        }

        continue;
      }

      await this.disbandRaffle(raffle.id);
      disbanded += 1;
    }

    return {
      processed: candidates.length,
      disbanded,
      markedExpiredThresholdMet,
    };
  }
}
