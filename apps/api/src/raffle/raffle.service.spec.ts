import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemType,
  Prisma,
  RaffleStatus,
  TransactionStatus,
} from '@prisma/client';
import { RaffleService } from './raffle.service';

describe('RaffleService', () => {
  const raffleId = '11111111-1111-1111-1111-111111111111';
  const buyerId = '22222222-2222-2222-2222-222222222222';
  const rafflerId = '33333333-3333-3333-3333-333333333333';

  const mockTx = {
    $queryRaw: jest.fn(),
    raffle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      createMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    raffleEvent: {
      create: jest.fn(),
    },
    pendingRaffleImageUpload: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockPrisma = {
    $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    ),
    raffle: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    raffleEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    pendingRaffleImageUpload: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as Prisma.TransactionClient & {
    $transaction: jest.Mock;
    raffle: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    raffleEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    pendingRaffleImageUpload: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const service = new RaffleService(mockPrisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ id: raffleId }]);
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId,
      title: 'Test',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 3,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTx.user.findUnique.mockResolvedValue({ id: buyerId });
    mockTx.transaction.create.mockResolvedValue({ id: 'tx-1' });
    mockTx.transaction.updateMany.mockResolvedValue({ count: 2 });
    mockTx.ticket.createMany.mockResolvedValue({ count: 2 });
    mockTx.ticket.count.mockResolvedValue(10);
    mockTx.ticket.findFirst.mockResolvedValue({
      id: 'ticket-8',
      ticketNumber: 8,
    });
    mockTx.raffle.update.mockResolvedValue(undefined);
    mockTx.raffle.updateMany.mockResolvedValue({ count: 1 });
    mockTx.raffle.create.mockResolvedValue({
      id: raffleId,
      rafflerId,
      title: 'Created raffle',
      description: null,
      imageUrls: [],
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 0,
      minSellThrough: null,
      status: RaffleStatus.DRAFT,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTx.raffleEvent.create.mockResolvedValue(undefined);
    mockTx.pendingRaffleImageUpload.findMany.mockResolvedValue([]);
    mockTx.pendingRaffleImageUpload.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.raffle.findMany.mockResolvedValue([]);
    mockPrisma.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId,
      title: 'Completed raffle',
      description: null,
      imageUrls: [],
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 10,
      minSellThrough: null,
      status: RaffleStatus.COMPLETED,
      startTime: new Date(),
      endTime: new Date(Date.now() - 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
      raffler: {
        id: rafflerId,
        email: 'raffler@example.com',
      },
      events: [
        {
          id: 'event-1',
          raffleId,
          eventType: 'WINNER_SELECTED',
          winnerTicketId: 'ticket-8',
          metadata: null,
          createdAt: new Date(),
          winnerTicket: {
            id: 'ticket-8',
            ticketNumber: 8,
            buyer: {
              id: buyerId,
              email: 'winner@example.com',
            },
          },
        },
      ],
    });
    mockPrisma.raffle.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: rafflerId,
    });
    mockPrisma.pendingRaffleImageUpload.findMany.mockResolvedValue([]);
    mockPrisma.pendingRaffleImageUpload.deleteMany.mockResolvedValue({
      count: 0,
    });
  });

  it('claims pending uploads owned by the requester during raffle creation', async () => {
    const rafflerId = '33333333-3333-3333-3333-333333333333';
    const imageUrls = [
      '/api/uploads/raffles/img-a.png',
      '/api/uploads/raffles/img-b.webp',
    ];
    const now = new Date(Date.now() + 60_000).toISOString();
    mockTx.pendingRaffleImageUpload.findMany.mockResolvedValue([
      {
        id: 'upload-a',
        fileName: 'img-a.png',
        urlPath: imageUrls[0],
      },
      {
        id: 'upload-b',
        fileName: 'img-b.webp',
        urlPath: imageUrls[1],
      },
    ]);
    mockTx.pendingRaffleImageUpload.updateMany.mockResolvedValue({ count: 2 });
    mockTx.raffle.create.mockResolvedValue({
      id: raffleId,
      rafflerId,
      title: 'Created raffle',
      description: null,
      imageUrls,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 0,
      minSellThrough: null,
      status: RaffleStatus.DRAFT,
      startTime: new Date(),
      endTime: new Date(now),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(
      {
        rafflerId,
        title: 'Created raffle',
        totalTickets: 10,
        ticketPrice: 500,
        endTime: now,
        imageUrls,
        itemType: ItemType.PHYSICAL,
      },
      rafflerId,
    );

    const anyDate = expect.any(Date) as unknown as Date;
    expect(mockTx.pendingRaffleImageUpload.findMany).toHaveBeenCalledWith({
      where: {
        ownerId: rafflerId,
        consumedAt: null,
        expiresAt: { gt: anyDate },
        fileName: { in: ['img-a.png', 'img-b.webp'] },
      },
      select: {
        id: true,
        fileName: true,
        urlPath: true,
      },
    });
    expect(mockTx.pendingRaffleImageUpload.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['upload-a', 'upload-b'] },
        ownerId: rafflerId,
        consumedAt: null,
      },
      data: {
        raffleId,
        consumedAt: anyDate,
      },
    });
    expect(result.imageUrls).toEqual(imageUrls);
  });

  it('rejects raffle creation when imageUrls include missing or unowned uploads', async () => {
    const rafflerId = '33333333-3333-3333-3333-333333333333';
    mockTx.pendingRaffleImageUpload.findMany.mockResolvedValue([
      {
        id: 'upload-a',
        fileName: 'img-a.png',
        urlPath: '/api/uploads/raffles/img-a.png',
      },
    ]);

    await expect(
      service.create(
        {
          rafflerId,
          title: 'Created raffle',
          totalTickets: 10,
          ticketPrice: 500,
          endTime: new Date(Date.now() + 60_000).toISOString(),
          imageUrls: [
            '/api/uploads/raffles/img-a.png',
            '/api/uploads/raffles/img-b.png',
          ],
          itemType: ItemType.PHYSICAL,
        },
        rafflerId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('purchases tickets and returns allocation details', async () => {
    const result = await service.purchaseTickets(raffleId, {
      buyerId,
      quantity: 2,
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: {
        raffleId,
        userId: buyerId,
        amount: 1000,
        status: TransactionStatus.SUCCEEDED,
      },
    });
    expect(result).toEqual({
      raffleId,
      transactionId: 'tx-1',
      quantity: 2,
      ticketNumbers: [4, 5],
      totalAmount: 1000,
      raffleStatus: RaffleStatus.ACTIVE,
    });
  });

  it('redacts winner email for public raffle detail requests', async () => {
    const result = await service.findOne(raffleId);

    expect(result.events[0]?.winnerTicket?.buyer?.email).toBeNull();
    expect(result.raffler.email).toBe('raffler@example.com');
  });

  it('shows winner email to raffle owner in raffle detail', async () => {
    const result = await service.findOne(raffleId, {
      userId: rafflerId,
      role: 'USER',
    });

    expect(result.events[0]?.winnerTicket?.buyer?.email).toBe(
      'winner@example.com',
    );
  });

  it('shows winner email to admin in raffle detail', async () => {
    const result = await service.findOne(raffleId, {
      userId: '99999999-9999-9999-9999-999999999999',
      role: 'ADMIN',
    });

    expect(result.events[0]?.winnerTicket?.buyer?.email).toBe(
      'winner@example.com',
    );
  });

  it('marks raffle as SOLD_OUT when final tickets are purchased', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Test',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 5,
      ticketPrice: 500,
      ticketsSold: 4,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.purchaseTickets(raffleId, {
      buyerId,
      quantity: 1,
    });

    expect(mockTx.raffle.update).toHaveBeenCalledWith({
      where: { id: raffleId },
      data: {
        status: RaffleStatus.SOLD_OUT,
        ticketsSold: 5,
      },
    });
    expect(result.raffleStatus).toBe(RaffleStatus.SOLD_OUT);
  });

  it('resolves a winner for a SOLD_OUT raffle', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Sold out raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 1,
      ticketPrice: 500,
      ticketsSold: 1,
      minSellThrough: null,
      status: RaffleStatus.SOLD_OUT,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTx.ticket.count.mockResolvedValue(1);
    mockTx.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      ticketNumber: 1,
    });

    const result = await service.resolveWinner(raffleId);

    expect(mockTx.raffle.update).toHaveBeenCalledWith({
      where: { id: raffleId },
      data: { status: RaffleStatus.COMPLETED },
    });
    expect(result).toEqual({
      raffleId,
      winnerTicketId: 'ticket-1',
      winnerTicketNumber: 1,
      ticketCount: 1,
      randomIndex: 0,
      raffleStatus: RaffleStatus.COMPLETED,
    });
  });

  it('throws when resolving winner for a non-sold-out raffle', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Active raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 3,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.resolveWinner(raffleId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('disbands an expired raffle and marks transactions as refunded', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Expired raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 4,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.disbandRaffle(raffleId);

    expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        raffleId,
        status: TransactionStatus.SUCCEEDED,
      },
      data: {
        status: TransactionStatus.REFUNDED,
      },
    });
    expect(mockTx.raffle.update).toHaveBeenCalledWith({
      where: { id: raffleId },
      data: { status: RaffleStatus.DISBANDED },
    });
    expect(result).toEqual({
      raffleId,
      raffleStatus: RaffleStatus.DISBANDED,
      refundedTransactions: 2,
      sellThroughPercent: 40,
    });
  });

  it('throws when disbanding a raffle before expiration', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Active raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 4,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.disbandRaffle(raffleId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws when raffle met minimum sell-through threshold', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Threshold raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 8,
      minSellThrough: 75,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.disbandRaffle(raffleId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('processes expired raffles by disbanding eligible entries', async () => {
    const disbandSpy = jest.spyOn(service, 'disbandRaffle').mockResolvedValue({
      raffleId,
      raffleStatus: RaffleStatus.DISBANDED,
      refundedTransactions: 1,
      sellThroughPercent: 20,
    });

    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: raffleId,
        totalTickets: 10,
        ticketsSold: 2,
        minSellThrough: null,
      },
      {
        id: '33333333-3333-3333-3333-333333333334',
        totalTickets: 10,
        ticketsSold: 8,
        minSellThrough: 75,
      },
    ]);

    const result = await service.processExpiredRaffles();

    expect(disbandSpy).toHaveBeenCalledTimes(1);
    expect(disbandSpy).toHaveBeenCalledWith(raffleId);
    expect(mockPrisma.raffle.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.raffleEvent.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      processed: 2,
      disbanded: 1,
      markedExpiredThresholdMet: 1,
    });

    disbandSpy.mockRestore();
  });

  it('does not emit duplicate EXPIRED events when threshold update does not change a row', async () => {
    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: raffleId,
        totalTickets: 10,
        ticketsSold: 8,
        minSellThrough: 75,
      },
    ]);
    mockPrisma.raffle.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processExpiredRaffles();

    expect(mockPrisma.raffle.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.raffleEvent.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      disbanded: 0,
      markedExpiredThresholdMet: 0,
    });
  });

  it('skips sold-out candidates during expired processing', async () => {
    const disbandSpy = jest.spyOn(service, 'disbandRaffle').mockResolvedValue({
      raffleId,
      raffleStatus: RaffleStatus.DISBANDED,
      refundedTransactions: 1,
      sellThroughPercent: 20,
    });

    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: raffleId,
        totalTickets: 10,
        ticketsSold: 10,
        minSellThrough: null,
      },
    ]);

    const result = await service.processExpiredRaffles();

    expect(disbandSpy).not.toHaveBeenCalled();
    expect(mockPrisma.raffle.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.raffleEvent.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: 1,
      disbanded: 0,
      markedExpiredThresholdMet: 0,
    });

    disbandSpy.mockRestore();
  });

  it('throws when raffle is not found', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    await expect(
      service.purchaseTickets(raffleId, {
        buyerId,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when purchase quantity exceeds remaining tickets', async () => {
    mockTx.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId: '33333333-3333-3333-3333-333333333333',
      title: 'Test',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 9,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.purchaseTickets(raffleId, {
        buyerId,
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when buyer does not exist', async () => {
    mockTx.user.findUnique.mockResolvedValue(null);

    await expect(
      service.purchaseTickets(raffleId, {
        buyerId,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
