import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemType, Raffle, RaffleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';

@Injectable()
export class RafflesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRaffleDto: CreateRaffleDto): Promise<Raffle> {
    const endTime = new Date(createRaffleDto.endTime);
    if (endTime.getTime() <= Date.now()) {
      throw new BadRequestException('endTime must be in the future');
    }

    const raffler = await this.prisma.user.findUnique({
      where: { id: createRaffleDto.rafflerId },
      select: { id: true },
    });

    if (!raffler) {
      throw new BadRequestException('rafflerId does not exist');
    }

    const status = createRaffleDto.status ?? RaffleStatus.DRAFT;

    const raffle = await this.prisma.raffle.create({
      data: {
        rafflerId: createRaffleDto.rafflerId,
        title: createRaffleDto.title,
        description: createRaffleDto.description,
        itemType: createRaffleDto.itemType ?? ItemType.PHYSICAL,
        totalTickets: createRaffleDto.totalTickets,
        ticketPrice: createRaffleDto.ticketPrice,
        minSellThrough: createRaffleDto.minSellThrough,
        status,
        endTime,
      },
    });

    await this.prisma.raffleEvent.create({
      data: {
        raffleId: raffle.id,
        eventType: 'CREATED',
        metadata: {
          status,
          totalTickets: raffle.totalTickets,
          ticketPrice: raffle.ticketPrice,
        },
      },
    });

    return raffle;
  }

  async findAll(): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Raffle> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
    });

    if (!raffle) {
      throw new NotFoundException(`Raffle ${id} not found`);
    }

    return raffle;
  }
}
