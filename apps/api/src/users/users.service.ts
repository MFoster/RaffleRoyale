import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

const publicUserSelect = {
  id: true,
  email: true,
  phone: true,
  kycStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    const passwordHash = await hash(createUserDto.password, 12);

    try {
      return await this.prisma.user.create({
        data: {
          email: createUserDto.email.toLowerCase(),
          phone: createUserDto.phone,
          passwordHash,
          kycStatus: createUserDto.kycStatus,
        },
        select: publicUserSelect,
      });
    } catch {
      throw new ConflictException('A user with this email already exists');
    }
  }

  async findAll(): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: publicUserSelect,
    });
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }
}
