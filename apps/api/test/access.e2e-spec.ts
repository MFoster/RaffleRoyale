import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/auth/auth.service';
import { RafflesService } from './../src/raffles/raffles.service';
import { UsersService } from './../src/users/users.service';

describe('Access Control (e2e)', () => {
  let app: INestApplication<App>;

  const mockRafflesService = {
    create: jest.fn((dto: unknown) => dto),
    findAll: jest.fn(() => []),
    findOne: jest.fn((id: string) => ({ id })),
    purchaseTickets: jest.fn(() => ({ ok: true })),
    resolveWinner: jest.fn(() => ({ ok: true })),
    disbandRaffle: jest.fn(() => ({ ok: true })),
    findEvents: jest.fn(() => []),
    processExpiredRaffles: jest.fn(() => ({
      processed: 0,
      disbanded: 0,
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

  it('allows public raffle listing without bearer token', () => {
    return request(app.getHttpServer()).get('/raffles').expect(200);
  });

  it('allows public user registration without bearer token', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'new-user@example.com',
        password: 'new-user-password',
      })
      .expect(201);
  });

  it('blocks raffle creation when bearer token is missing', () => {
    return request(app.getHttpServer())
      .post('/raffles')
      .send({
        rafflerId: '11111111-1111-1111-1111-111111111111',
        title: 'Test',
        totalTickets: 10,
        ticketPrice: 500,
        endTime: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(401);
  });

  it('blocks raffle creation when user does not match rafflerId', async () => {
    const token = await login('99999999-9999-9999-9999-999999999999');

    return request(app.getHttpServer())
      .post('/raffles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rafflerId: '11111111-1111-1111-1111-111111111111',
        title: 'Test',
        totalTickets: 10,
        ticketPrice: 500,
        endTime: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(403);
  });

  it('allows raffle creation when user matches rafflerId', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = await login(userId);

    return request(app.getHttpServer())
      .post('/raffles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rafflerId: userId,
        title: 'Test',
        totalTickets: 10,
        ticketPrice: 500,
        endTime: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);
  });

  it('requires ADMIN role for process-expired endpoint', async () => {
    const userToken = await login('11111111-1111-1111-1111-111111111111');
    const adminToken = await login(
      '11111111-1111-1111-1111-111111111111',
      'ADMIN',
    );

    await request(app.getHttpServer())
      .post('/raffles/process-expired')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/raffles/process-expired')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  it('blocks ticket purchase for mismatched buyerId', async () => {
    const token = await login('11111111-1111-1111-1111-111111111111');

    return request(app.getHttpServer())
      .post('/raffles/11111111-1111-1111-1111-111111111111/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buyerId: '22222222-2222-2222-2222-222222222222',
        quantity: 1,
      })
      .expect(403);
  });

  it('allows user to read own profile and blocks others', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const token = await login(userId);

    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/users/22222222-2222-2222-2222-222222222222')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('requires ADMIN role for users list', async () => {
    const userToken = await login('11111111-1111-1111-1111-111111111111');
    const adminToken = await login(
      '11111111-1111-1111-1111-111111111111',
      'ADMIN',
    );

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('allows refreshing a valid refresh token', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: '11111111-1111-1111-1111-111111111111@example.com',
        password: 'user-password',
      })
      .expect(201);

    const refreshToken = (loginResponse.body as { refreshToken: string })
      .refreshToken;

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);
  });
});
