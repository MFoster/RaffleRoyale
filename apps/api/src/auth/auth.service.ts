import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext, AuthRole } from './auth.types';

type JwtPayload = {
  sub: string;
  role: AuthRole;
  tokenType: 'access' | 'refresh';
};

type JwtExpiry = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async issueToken(userId: string, role?: AuthRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.createTokenPair(userId, role ?? 'USER');
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createTokenPair(user.id, 'USER');
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      {
        secret:
          process.env.JWT_REFRESH_SECRET ?? 'dev-jwt-refresh-secret-change-me',
      },
    );

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    return this.createTokenPair(payload.sub, payload.role);
  }

  async verifyToken(token: string): Promise<AuthContext> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Access token required');
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  }

  private async createTokenPair(userId: string, role: AuthRole) {
    const accessTokenExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as JwtExpiry;
    const refreshTokenExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as JwtExpiry;

    const accessPayload: JwtPayload = {
      sub: userId,
      role,
      tokenType: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      role,
      tokenType: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret:
        process.env.JWT_REFRESH_SECRET ?? 'dev-jwt-refresh-secret-change-me',
      expiresIn: refreshTokenExpiresIn,
    });

    return {
      userId,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }
}
