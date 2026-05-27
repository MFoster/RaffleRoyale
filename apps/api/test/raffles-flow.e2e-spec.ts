import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { RafflesService } from './../src/raffles/raffles.service';
import { UsersService } from './../src/users/users.service';

describe('Raffles Flow (e2e)', () => {
  let app: INestApplication<App>;

  const mockRafflesService = {
    create: jest.fn((dto: Record<string, unknown>) => ({
      id: 'raffle-1',
      ...dto,
    })),
    findAll: jest.fn(() => []),
    findOne: jest.fn((id: string) => ({ id })),
    purchaseTickets: jest.fn(() => ({
      raffleId: 'raffle-1',
      transactionId: 'tx-1',
      quantity: 1,
      ticketNumbers: [1],
      totalAmount: 500,
      raffleStatus: 'ACTIVE',
    })),
    resolveWinner: jest.fn(() => ({
      raffleId: 'raffle-1',
      winnerTicketId: 'ticket-1',
      winnerTicketNumber: 1,
      ticketCount: 1,
      randomIndex: 0,
      raffleStatus: 'COMPLETED',
    })),
    disbandRaffle: jest.fn(() => ({
      raffleId: 'raffle-1',
      raffleStatus: 'DISBANDED',
      refundedTransactions: 1,
      sellThroughPercent: 20,
    })),
    findEvents: jest.fn(() => []),
    processExpiredRaffles: jest.fn(() => ({
      processed: 1,
      disbanded: 1,
      markedExpiredThresholdMet: 0,
    })),
  };

  const mockUsersService = {
    create: jest.fn((dto: unknown) => dto),
    findAll: jest.fn(() => []),
    findOne: jest.fn((id: string) => ({ id })),
  };

  const mockAuthService = {
    login: jest.fn((email: string, password: string) => {
      const userId = email.split('@')[0];
      const role = password === 'admin-password' ? 'ADMIN' : 'USER';

      return {
        accessToken: `token|${userId}|${role}|access`,
        refreshToken: `token|${userId}|${role}|refresh`,
        tokenType: 'Bearer',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
      };
    }),
    refresh: jest.fn((refreshToken: string) => {
      const tokenPayload = refreshToken.replace('token|', '');
      const [userId, role] = tokenPayload.split('|');

      return {
        accessToken: `token|${userId}|${role}|access`,
        refreshToken: `token|${userId}|${role}|refresh`,
        tokenType: 'Bearer',
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
      };
    }),
    issueToken: jest.fn((userId: string, role?: 'USER' | 'ADMIN') => ({
      accessToken: `token|${userId}|${role ?? 'USER'}|access`,
      refreshToken: `token|${userId}|${role ?? 'USER'}|refresh`,
      tokenType: 'Bearer',
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    })),
    verifyToken: jest.fn((token: string) => {
      const tokenPayload = token.replace('token|', '');
      const [userId, role, tokenType] = tokenPayload.split('|');

      if (tokenType !== 'access') {
        throw new Error('Access token required');
      }

      return {
        userId,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      };
    }),
  };

  const login = async (
    userId: string,
    role?: 'USER' | 'ADMIN',
  ): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `${userId}@example.com`,
        password: role === 'ADMIN' ? 'admin-password' : 'user-password',
      })
      .expect(201);

    const tokenResponse = response.body as { accessToken: string };

    return tokenResponse.accessToken;
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RafflesService)
      .useValue(mockRafflesService)
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('allows authenticated user to create and purchase in own context', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = await login(userId);

    await request(app.getHttpServer())
      .post('/raffles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rafflerId: userId,
        title: 'GPU Raffle',
        totalTickets: 10,
        ticketPrice: 500,
        endTime: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/raffles/11111111-1111-1111-1111-111111111111/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buyerId: userId,
        quantity: 1,
      })
      .expect(201);

    expect(mockRafflesService.create).toHaveBeenCalledTimes(1);
    expect(mockRafflesService.purchaseTickets).toHaveBeenCalledTimes(1);
  });

  it('restricts admin-only lifecycle endpoints', async () => {
    const userToken = await login('11111111-1111-1111-1111-111111111111');
    const adminToken = await login(
      '11111111-1111-1111-1111-111111111111',
      'ADMIN',
    );

    await request(app.getHttpServer())
      .post('/raffles/11111111-1111-1111-1111-111111111111/resolve-winner')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/raffles/11111111-1111-1111-1111-111111111111/resolve-winner')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/raffles/11111111-1111-1111-1111-111111111111/disband')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/raffles/process-expired')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });
});
