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
import {
  QUICKNET_CHAIN_HASH,
  QUICKNET_GENESIS_TIME,
  QUICKNET_PERIOD_SECONDS,
  QUICKNET_PUBLIC_KEY,
  QUICKNET_SCHEME,
  randomnessFromSignature,
  revealWinnerProof,
  type BeaconChainInfo,
} from '@raffleroyale/raffle-draw';

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
      findFirst: jest.fn(),
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
      findFirst: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
      findFirst: jest.fn(),
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
      findFirst: jest.Mock;
    };
    ticket: {
      count: jest.Mock;
      findFirst: jest.Mock;
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

  const beaconInfo: BeaconChainInfo = {
    publicKey: QUICKNET_PUBLIC_KEY,
    period: QUICKNET_PERIOD_SECONDS,
    genesisTime: QUICKNET_GENESIS_TIME,
    chainHash: QUICKNET_CHAIN_HASH,
    scheme: QUICKNET_SCHEME,
    beaconId: 'quicknet',
  };
  // A real, signed drand quicknet round so the BLS verification path runs for
  // real in the reveal tests.
  const beaconRoundFixture = {
    round: 20000000,
    signature:
      '96892582a33552a7b67ba44ef09c3ccd535bbebe760c93ecf45be8958d0c0f06390c6d19d7bf492eb806af7eef6b125c',
  };
  const beaconRandomness = randomnessFromSignature(
    beaconRoundFixture.signature,
  );

  const mockBeacon = {
    buildCommitment: jest.fn(),
    getChainInfo: jest.fn().mockResolvedValue(beaconInfo),
    getRound: jest.fn().mockResolvedValue({
      ...beaconRoundFixture,
      randomness: beaconRandomness,
    }),
  };
  const mockExpirationScheduler = {
    createExpirationSchedule: jest.fn().mockResolvedValue(true),
    deleteExpirationSchedule: jest.fn().mockResolvedValue(undefined),
  };

  const service = new RaffleService(
    mockPrisma as never,
    mockBeacon as never,
    mockExpirationScheduler as never,
  );

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
      drawBeaconRound: BigInt(12345),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTx.raffleEvent.create.mockResolvedValue(undefined);
    mockTx.raffleEvent.findFirst.mockResolvedValue(null);
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
      drawBeaconRound: BigInt(67890),
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
    mockExpirationScheduler.createExpirationSchedule.mockResolvedValue(true);
    mockExpirationScheduler.deleteExpirationSchedule.mockResolvedValue(
      undefined,
    );
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
      drawBeaconRound: BigInt(12345),
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
    expect(result.drawBeaconRound).toBe(12345);
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

  it('creates an expiration schedule for active raffles', async () => {
    const endTime = new Date(Date.now() + 60_000).toISOString();
    mockTx.raffle.create.mockResolvedValue({
      id: raffleId,
      rafflerId,
      title: 'Scheduled raffle',
      description: null,
      imageUrls: [],
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 0,
      minSellThrough: null,
      status: RaffleStatus.ACTIVE,
      startTime: new Date(),
      endTime: new Date(endTime),
      drawBeaconRound: null,
      drawBeaconChainHash: null,
      drawScheme: null,
      drawCommittedAt: null,
      drawAvailableAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create(
      {
        rafflerId,
        title: 'Scheduled raffle',
        totalTickets: 10,
        ticketPrice: 500,
        endTime,
        status: RaffleStatus.ACTIVE,
      },
      rafflerId,
    );

    expect(
      mockExpirationScheduler.createExpirationSchedule,
    ).toHaveBeenCalledWith(expect.any(String), new Date(endTime));
  });

  it('removes a created schedule when raffle persistence fails', async () => {
    const endTime = new Date(Date.now() + 60_000).toISOString();
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('database failed'));

    await expect(
      service.create(
        {
          rafflerId,
          title: 'Scheduled raffle',
          totalTickets: 10,
          ticketPrice: 500,
          endTime,
          status: RaffleStatus.ACTIVE,
        },
        rafflerId,
      ),
    ).rejects.toThrow('database failed');

    expect(
      mockExpirationScheduler.deleteExpirationSchedule,
    ).toHaveBeenCalledWith(expect.any(String));
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

  it('serializes drawBeaconRound in public raffle listings', async () => {
    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: raffleId,
        rafflerId,
        title: 'Listing',
        description: null,
        imageUrls: [],
        itemType: ItemType.PHYSICAL,
        totalTickets: 10,
        ticketPrice: 500,
        ticketsSold: 2,
        minSellThrough: null,
        status: RaffleStatus.ACTIVE,
        drawBeaconRound: BigInt(67890),
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.findAll();

    expect(result).toEqual([
      expect.objectContaining({
        drawBeaconRound: 67890,
      }),
    ]);
  });

  it('redacts winner email for unauthenticated raffle detail requests', async () => {
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
    expect(result.drawBeaconRound).toBe(67890);
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

  it('commits a future beacon round for a SOLD_OUT raffle', async () => {
    const soldOut = {
      id: raffleId,
      rafflerId,
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
      drawBeaconRound: null,
      drawBeaconChainHash: null,
      drawScheme: null,
      drawCommittedAt: null,
      drawAvailableAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.raffle.findUnique.mockResolvedValue(soldOut);
    mockPrisma.raffleEvent.findFirst.mockResolvedValue(null);
    mockPrisma.ticket.count.mockResolvedValue(1);
    mockTx.raffle.findUnique.mockResolvedValue(soldOut);

    const availableAt = new Date(Date.now() + 60000).toISOString();
    mockBeacon.buildCommitment.mockResolvedValue({
      chainHash: QUICKNET_CHAIN_HASH,
      scheme: QUICKNET_SCHEME,
      round: 12345,
      committedAt: new Date().toISOString(),
      availableAt,
      algorithm: 'drand-quicknet-commit-reveal-v1',
    });

    const result = await service.resolveWinner(raffleId);

    expect(result).toMatchObject({
      phase: 'committed',
      raffleId,
      raffleStatus: RaffleStatus.PENDING_DRAW,
      beaconRound: 12345,
      availableAt,
    });
    const updateCalls = mockTx.raffle.update.mock.calls as Array<
      [
        {
          where: { id: string };
          data: {
            status: RaffleStatus;
            drawBeaconRound: bigint;
            drawBeaconChainHash: string;
          };
        },
      ]
    >;
    const updateCall = updateCalls[0]?.[0];
    expect(updateCall).toMatchObject({
      where: { id: raffleId },
      data: {
        status: RaffleStatus.PENDING_DRAW,
        drawBeaconRound: BigInt(12345),
        drawBeaconChainHash: QUICKNET_CHAIN_HASH,
      },
    });
    const committedEventCalls = mockTx.raffleEvent.create.mock.calls as Array<
      [{ data: { eventType: string } }]
    >;
    expect(committedEventCalls[0]?.[0].data.eventType).toBe('DRAW_COMMITTED');
  });

  it('commits a draw for an EXPIRED raffle that met its sell-through threshold', async () => {
    const expiredEligible = {
      id: raffleId,
      rafflerId,
      title: 'Threshold-met expired raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 10,
      ticketPrice: 500,
      ticketsSold: 8,
      minSellThrough: 75,
      status: RaffleStatus.EXPIRED,
      startTime: new Date(),
      endTime: new Date(Date.now() - 3600000),
      drawBeaconRound: null,
      drawBeaconChainHash: null,
      drawScheme: null,
      drawCommittedAt: null,
      drawAvailableAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.raffle.findUnique.mockResolvedValue(expiredEligible);
    mockPrisma.raffleEvent.findFirst.mockResolvedValue(null);
    mockPrisma.ticket.count.mockResolvedValue(8);
    mockTx.raffle.findUnique.mockResolvedValue(expiredEligible);

    const availableAt = new Date(Date.now() + 60000).toISOString();
    mockBeacon.buildCommitment.mockResolvedValue({
      chainHash: QUICKNET_CHAIN_HASH,
      scheme: QUICKNET_SCHEME,
      round: 999,
      committedAt: new Date().toISOString(),
      availableAt,
      algorithm: 'drand-quicknet-commit-reveal-v1',
    });

    const result = await service.resolveWinner(raffleId);

    expect(result).toMatchObject({
      phase: 'committed',
      raffleStatus: RaffleStatus.PENDING_DRAW,
      beaconRound: 999,
    });
  });

  it('reveals and verifies the winner once the committed round is available', async () => {
    const pending = {
      id: raffleId,
      rafflerId,
      title: 'Pending-draw raffle',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 8,
      ticketPrice: 500,
      ticketsSold: 8,
      minSellThrough: null,
      status: RaffleStatus.PENDING_DRAW,
      startTime: new Date(),
      endTime: new Date(Date.now() - 3600000),
      drawBeaconRound: BigInt(beaconRoundFixture.round),
      drawBeaconChainHash: QUICKNET_CHAIN_HASH,
      drawScheme: QUICKNET_SCHEME,
      drawCommittedAt: new Date(Date.now() - 120000),
      drawAvailableAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.raffle.findUnique.mockResolvedValue(pending);
    mockPrisma.raffleEvent.findFirst.mockResolvedValue(null);
    mockPrisma.ticket.count.mockResolvedValue(8);
    mockTx.raffle.findUnique.mockResolvedValue(pending);
    mockTx.raffleEvent.findFirst.mockResolvedValue(null);
    mockTx.ticket.count.mockResolvedValue(8);

    const expected = revealWinnerProof({
      raffleId,
      ticketCount: 8,
      round: { ...beaconRoundFixture, randomness: beaconRandomness },
      info: beaconInfo,
    });
    mockTx.ticket.findFirst.mockResolvedValue({
      id: 'ticket-x',
      ticketNumber: expected.winnerIndex + 1,
    });

    const result = await service.resolveWinner(raffleId);

    expect(result).toMatchObject({
      phase: 'revealed',
      raffleStatus: RaffleStatus.COMPLETED,
      winnerTicketId: 'ticket-x',
      winnerIndex: expected.winnerIndex,
      beaconRound: beaconRoundFixture.round,
      randomness: beaconRandomness,
    });
    expect(mockTx.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ skip: expected.winnerIndex }),
    );
    expect(mockTx.raffle.update).toHaveBeenCalledWith({
      where: { id: raffleId },
      data: { status: RaffleStatus.COMPLETED },
    });
    const winnerCreate = (
      mockTx.raffleEvent.create.mock.calls as Array<
        [
          {
            data: {
              eventType?: string;
              metadata?: {
                algorithm?: string;
                beacon?: { round?: number };
              };
            };
          },
        ]
      >
    ).find(([call]) => call.data.eventType === 'WINNER_SELECTED');
    expect(winnerCreate?.[0].data.metadata?.algorithm).toBe(
      'drand-quicknet-commit-reveal-v1',
    );
    expect(winnerCreate?.[0].data.metadata?.beacon?.round).toBe(
      beaconRoundFixture.round,
    );
  });

  it('reports a pending draw when the committed round is not yet available', async () => {
    const pendingFuture = {
      id: raffleId,
      rafflerId,
      title: 'Pending-draw raffle (future)',
      description: null,
      itemType: ItemType.PHYSICAL,
      totalTickets: 8,
      ticketPrice: 500,
      ticketsSold: 8,
      minSellThrough: null,
      status: RaffleStatus.PENDING_DRAW,
      startTime: new Date(),
      endTime: new Date(Date.now() - 3600000),
      drawBeaconRound: BigInt(beaconRoundFixture.round),
      drawBeaconChainHash: QUICKNET_CHAIN_HASH,
      drawScheme: QUICKNET_SCHEME,
      drawCommittedAt: new Date(Date.now() - 1000),
      drawAvailableAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.raffle.findUnique.mockResolvedValue(pendingFuture);
    mockPrisma.raffleEvent.findFirst.mockResolvedValue(null);

    const result = await service.resolveWinner(raffleId);

    expect(result).toMatchObject({
      phase: 'pending',
      raffleStatus: RaffleStatus.PENDING_DRAW,
      beaconRound: beaconRoundFixture.round,
    });
    expect(mockBeacon.getRound).not.toHaveBeenCalled();
  });

  it('throws when resolving winner for a non-sold-out raffle', async () => {
    mockPrisma.raffle.findUnique.mockResolvedValue({
      id: raffleId,
      rafflerId,
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
      drawBeaconRound: null,
      drawBeaconChainHash: null,
      drawScheme: null,
      drawCommittedAt: null,
      drawAvailableAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.raffleEvent.findFirst.mockResolvedValue(null);

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
