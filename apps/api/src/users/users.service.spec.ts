import { ConflictException, NotFoundException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const publicUser = {
    id: userId,
    email: 'user@example.com',
    phone: '555-0100',
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

  const mockPrisma = {
    user: {
      create: jest.fn<Promise<typeof publicUser>, [CreateUserCall]>(),
      findMany: jest.fn<Promise<(typeof publicUser)[]>, [FindManyCall]>(),
      findUnique: jest.fn<
        Promise<typeof publicUser | null>,
        [FindUniqueCall]
      >(),
    },
  };

  const service = new UsersService(mockPrisma as never);

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
});
