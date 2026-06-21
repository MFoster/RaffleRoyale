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
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const publicUserSelect = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  bio: true,
  kycStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

const publicProfileSelect = {
  id: true,
  displayName: true,
  bio: true,
  kycStatus: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const publicRaffleListingSelect = {
  id: true,
  title: true,
  description: true,
  imageUrls: true,
  status: true,
  itemType: true,
  totalTickets: true,
  ticketPrice: true,
  ticketsSold: true,
  endTime: true,
  createdAt: true,
} satisfies Prisma.RaffleSelect;

export type PublicProfileRaffle = Prisma.RaffleGetPayload<{
  select: typeof publicRaffleListingSelect;
}>;

export type PublicProfile = Prisma.UserGetPayload<{
  select: typeof publicProfileSelect;
}> & {
  raffles: PublicProfileRaffle[];
};

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
      endTime: true,
      imageUrls: true,
      events: {
        where: { eventType: 'WINNER_SELECTED' },
        select: {
          winnerTicket: {
            select: {
              ticketNumber: true,
              buyerId: true,
            },
          },
        },
      },
    },
  },
  tickets: {
    select: {
      ticketNumber: true,
    },
    orderBy: { ticketNumber: 'asc' },
  },
} satisfies Prisma.TransactionSelect;

export type TicketOutcome = 'PENDING' | 'WON' | 'LOST' | 'CLOSED';

export type UserTicketActivityItem = {
  transactionId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: Date;
  quantity: number;
  ticketNumbers: number[];
  outcome: TicketOutcome;
  winnerTicketNumber: number | null;
  raffle: {
    id: string;
    title: string;
    status: RaffleStatus;
    endTime: Date;
    imageUrls: string[];
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

  async updateProfile(
    id: string,
    updateUserProfileDto: UpdateUserProfileDto,
  ): Promise<PublicUser> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          displayName: updateUserProfileDto.displayName,
          bio: updateUserProfileDto.bio,
          phone: updateUserProfileDto.phone,
        },
        select: publicUserSelect,
      });
    } catch {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  async getPublicProfile(id: string): Promise<PublicProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicProfileSelect,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const raffles = await this.prisma.raffle.findMany({
      where: {
        rafflerId: id,
        status: { not: RaffleStatus.DRAFT },
      },
      orderBy: { createdAt: 'desc' },
      select: publicRaffleListingSelect,
    });

    return { ...user, raffles };
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

      const winnerTicket =
        transaction.raffle.events[0]?.winnerTicket ?? null;
      const winnerTicketNumber = winnerTicket?.ticketNumber ?? null;

      let outcome: TicketOutcome = 'PENDING';
      if (transaction.raffle.status === RaffleStatus.COMPLETED) {
        outcome =
          winnerTicket && winnerTicket.buyerId === userId ? 'WON' : 'LOST';
      } else if (
        transaction.raffle.status === RaffleStatus.DISBANDED ||
        transaction.raffle.status === RaffleStatus.EXPIRED
      ) {
        outcome = 'CLOSED';
      }

      return {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt,
        quantity: ticketNumbers.length,
        ticketNumbers,
        outcome,
        winnerTicketNumber,
        raffle: {
          id: transaction.raffle.id,
          title: transaction.raffle.title,
          status: transaction.raffle.status,
          endTime: transaction.raffle.endTime,
          imageUrls: transaction.raffle.imageUrls,
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
