import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import {
  Prisma,
  Raffle,
  RaffleStatus,
  TransactionStatus,
} from '@prisma/client';
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

const userTicketActivitySelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  createdAt: true,
  raffle: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  tickets: {
    select: {
      ticketNumber: true,
    },
    orderBy: { ticketNumber: 'asc' },
  },
} satisfies Prisma.TransactionSelect;

export type UserTicketActivityItem = {
  transactionId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: Date;
  quantity: number;
  ticketNumbers: number[];
  raffle: {
    id: string;
    title: string;
    status: RaffleStatus;
  };
};

@Injectable()
export class UserService {
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

  async findTicketActivity(userId: string): Promise<UserTicketActivityItem[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
      select: userTicketActivitySelect,
    });

    return transactions.map((transaction) => {
      const ticketNumbers = transaction.tickets.map(
        (ticket) => ticket.ticketNumber,
      );

      return {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        quantity: ticketNumbers.length,
        ticketNumbers,
        raffle: {
          id: transaction.raffle.id,
          title: transaction.raffle.title,
          status: transaction.raffle.status,
        },
      };
    });
  }

  async findUserRaffles(userId: string): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      where: { rafflerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
