import { ConflictException, NotFoundException } from '@nestjs/common';
import { KycStatus, RaffleStatus, TransactionStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import { UserService } from './user.service';

describe('UserService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const publicUser = {
    id: userId,
    email: 'user@example.com',
    phone: '555-0100',
    displayName: 'Casey Raffler',
    bio: 'Long-time collector of rare gear.',
    kycStatus: KycStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  type CreateUserCall = {
    data: {
      email: string;
      phone?: string;
      passwordHash: string;
      kycStatus?: KycStatus;
    };
    select: Record<string, true>;
  };

  type FindManyCall = {
    orderBy: {
      createdAt: 'desc';
    };
    select: Record<string, true>;
  };

  type FindUniqueCall = {
    where: {
      id: string;
    };
    select: Record<string, true>;
  };

  type FindTransactionsCall = {
    where: {
      userId: string;
    };
    orderBy: {
      createdAt: 'desc';
    };
    select: Record<string, unknown>;
  };

  type FindRafflesCall = {
    where: {
      rafflerId: string;
    };
    orderBy: {
      createdAt: 'desc';
    };
  };

  const mockPrisma = {
    user: {
      create: jest.fn<Promise<typeof publicUser>, [CreateUserCall]>(),
      update: jest.fn<Promise<typeof publicUser>, [unknown]>(),
      findMany: jest.fn<Promise<(typeof publicUser)[]>, [FindManyCall]>(),
      findUnique: jest.fn<
        Promise<typeof publicUser | null>,
        [FindUniqueCall]
      >(),
    },
    transaction: {
      findMany: jest.fn<
        Promise<
          Array<{
            id: string;
            amount: number;
            currency: string;
            status: TransactionStatus;
            createdAt: Date;
            raffle: {
              id: string;
              title: string;
              status: RaffleStatus;
              endTime: Date;
              imageUrls: string[];
              events: Array<{
                winnerTicket: { ticketNumber: number; buyerId: string } | null;
              }>;
            };
            tickets: Array<{ ticketNumber: number }>;
          }>
        >,
        [FindTransactionsCall]
      >(),
    },
    raffle: {
      findMany: jest.fn<
        Promise<
          Array<{
            id: string;
            rafflerId: string;
            title: string;
            status: RaffleStatus;
          }>
        >,
        [FindRafflesCall]
      >(),
    },
  };

  const service = new UserService(mockPrisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user with a hashed password and returns only public fields', async () => {
    mockPrisma.user.create.mockResolvedValue(publicUser);

    const result = await service.create({
      email: 'USER@Example.com',
      phone: publicUser.phone,
      password: 'supersecret',
    });

    const createArgs = mockPrisma.user.create.mock.calls[0]?.[0];
    expect(createArgs).toBeDefined();
    if (!createArgs) {
      throw new Error('Expected create to be called');
    }
    expect(createArgs.data.email).toBe('user@example.com');
    expect(createArgs.data.phone).toBe(publicUser.phone);
    expect(createArgs.select).toEqual({
      id: true,
      email: true,
      phone: true,
      displayName: true,
      bio: true,
      kycStatus: true,
      createdAt: true,
      updatedAt: true,
    });
    expect(await compare('supersecret', createArgs.data.passwordHash)).toBe(
      true,
    );
    expect(result).toEqual(publicUser);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('lists only public user fields', async () => {
    mockPrisma.user.findMany.mockResolvedValue([publicUser]);

    await expect(service.findAll()).resolves.toEqual([publicUser]);
    const findManyArgs = mockPrisma.user.findMany.mock.calls[0]?.[0];
    expect(findManyArgs).toBeDefined();
    expect(findManyArgs).toEqual({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        bio: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('throws when a requested user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps persistence errors to a signup conflict', async () => {
    mockPrisma.user.create.mockRejectedValue(new Error('duplicate'));

    await expect(
      service.create({
        email: 'user@example.com',
        password: 'supersecret',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns aggregated ticket activity by transaction', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        amount: 1500,
        currency: 'usd',
        status: TransactionStatus.SUCCEEDED,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        raffle: {
          id: 'raffle-1',
          title: 'GPU Raffle',
          status: RaffleStatus.ACTIVE,
          endTime: new Date('2026-02-01T00:00:00.000Z'),
          imageUrls: ['/api/uploads/raffles/gpu.jpg'],
          events: [],
        },
        tickets: [
          { ticketNumber: 42 },
          { ticketNumber: 43 },
          { ticketNumber: 44 },
        ],
      },
    ]);

    const result = await service.findTicketActivity(userId);

    const findManyArgs = mockPrisma.transaction.findMany.mock.calls[0]?.[0];
    expect(findManyArgs).toBeDefined();
    expect(findManyArgs?.where).toEqual({ userId });
    expect(findManyArgs?.orderBy).toEqual({ createdAt: 'desc' });
    expect(result).toEqual([
      {
        transactionId: 'tx-1',
        amount: 1500,
        currency: 'usd',
        status: TransactionStatus.SUCCEEDED,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        quantity: 3,
        ticketNumbers: [42, 43, 44],
        outcome: 'PENDING',
        winnerTicketNumber: null,
        raffle: {
          id: 'raffle-1',
          title: 'GPU Raffle',
          status: RaffleStatus.ACTIVE,
          endTime: new Date('2026-02-01T00:00:00.000Z'),
          imageUrls: ['/api/uploads/raffles/gpu.jpg'],
        },
      },
    ]);
  });

  it('marks a completed raffle as won when the user holds the winning ticket', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-2',
        amount: 1000,
        currency: 'usd',
        status: TransactionStatus.SUCCEEDED,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        raffle: {
          id: 'raffle-2',
          title: 'Console Raffle',
          status: RaffleStatus.COMPLETED,
          endTime: new Date('2026-01-10T00:00:00.000Z'),
          imageUrls: [],
          events: [{ winnerTicket: { ticketNumber: 7, buyerId: userId } }],
        },
        tickets: [{ ticketNumber: 7 }],
      },
    ]);

    const [activity] = await service.findTicketActivity(userId);

    expect(activity?.outcome).toBe('WON');
    expect(activity?.winnerTicketNumber).toBe(7);
  });

  it('marks a completed raffle as lost when another user holds the winning ticket', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-3',
        amount: 1000,
        currency: 'usd',
        status: TransactionStatus.SUCCEEDED,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        raffle: {
          id: 'raffle-3',
          title: 'Console Raffle',
          status: RaffleStatus.COMPLETED,
          endTime: new Date('2026-01-10T00:00:00.000Z'),
          imageUrls: [],
          events: [
            { winnerTicket: { ticketNumber: 9, buyerId: 'someone-else' } },
          ],
        },
        tickets: [{ ticketNumber: 4 }],
      },
    ]);

    const [activity] = await service.findTicketActivity(userId);

    expect(activity?.outcome).toBe('LOST');
    expect(activity?.winnerTicketNumber).toBe(9);
  });

  it('updates editable profile fields and returns public fields', async () => {
    mockPrisma.user.update.mockResolvedValue(publicUser);

    const result = await service.updateProfile(userId, {
      displayName: 'Casey Raffler',
      bio: 'Long-time collector of rare gear.',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        displayName: 'Casey Raffler',
        bio: 'Long-time collector of rare gear.',
        phone: undefined,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        bio: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(result).toEqual(publicUser);
  });

  it('returns a public profile with non-draft listings', async () => {
    const profileUser = {
      id: userId,
      displayName: 'Casey Raffler',
      bio: 'Collector.',
      kycStatus: KycStatus.VERIFIED,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    mockPrisma.user.findUnique.mockResolvedValue(
      profileUser as unknown as typeof publicUser,
    );
    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: 'raffle-1',
        rafflerId: userId,
        title: 'GPU Raffle',
        status: RaffleStatus.ACTIVE,
      },
    ]);

    const result = await service.getPublicProfile(userId);

    const rafflesArgs = mockPrisma.raffle.findMany.mock.calls[0]?.[0];
    expect(rafflesArgs?.where).toEqual({
      rafflerId: userId,
      status: { not: RaffleStatus.DRAFT },
    });
    expect(result.id).toBe(userId);
    expect(result.raffles).toHaveLength(1);
  });

  it('lists raffles created by a specific user', async () => {
    mockPrisma.raffle.findMany.mockResolvedValue([
      {
        id: 'raffle-1',
        rafflerId: userId,
        title: 'GPU Raffle',
        status: RaffleStatus.ACTIVE,
      },
    ]);

    const result = await service.findUserRaffles(userId);

    expect(mockPrisma.raffle.findMany).toHaveBeenCalledWith({
      where: { rafflerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.rafflerId).toBe(userId);
  });
});
