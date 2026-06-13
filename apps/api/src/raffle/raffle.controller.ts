import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Raffle, RaffleEvent } from '@prisma/client';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';
import {
  MAX_RAFFLE_IMAGE_SIZE_BYTES,
  MAX_RAFFLE_IMAGE_UPLOADS,
  RaffleDetail,
  RaffleService,
} from './raffle.service';

@Controller('raffle')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RaffleController {
  constructor(private readonly raffleService: RaffleService) {}

  @Post('process-expired')
  @Roles('ADMIN')
  processExpiredRaffles() {
    return this.raffleService.processExpiredRaffles();
  }

  @Post()
  create(
    @Body() createRaffleDto: CreateRaffleDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<Raffle> {
    if (auth.role !== 'ADMIN' && auth.userId !== createRaffleDto.rafflerId) {
      throw new ForbiddenException('Cannot create raffle for another user');
    }

    return this.raffleService.create(createRaffleDto, auth.userId);
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('images', MAX_RAFFLE_IMAGE_UPLOADS, {
      limits: {
        fileSize: MAX_RAFFLE_IMAGE_SIZE_BYTES,
        files: MAX_RAFFLE_IMAGE_UPLOADS,
      },
    }),
  )
  async uploadImages(
    @UploadedFiles()
    files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    }> = [],
    @CurrentAuth() auth: AuthContext,
  ): Promise<{ imageUrls: string[] }> {
    return this.raffleService.uploadImages(files, auth.userId);
  }

  @Get()
  @Public()
  findAll(): Promise<Raffle[]> {
    return this.raffleService.findAll();
  }

  @Get(':id')
  @Public()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext | undefined,
  ): Promise<RaffleDetail> {
    return this.raffleService.findOne(id, auth);
  }

  @Post(':id/purchase')
  purchaseTickets(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() purchaseTicketsDto: PurchaseTicketsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    if (auth.role !== 'ADMIN' && auth.userId !== purchaseTicketsDto.buyerId) {
      throw new ForbiddenException('Cannot purchase tickets for another user');
    }

    return this.raffleService.purchaseTickets(id, purchaseTicketsDto);
  }

  @Post(':id/resolve-winner')
  @Roles('ADMIN')
  resolveWinner(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.resolveWinner(id);
  }

  @Post(':id/disband')
  @Roles('ADMIN')
  disband(@Param('id', ParseUUIDPipe) id: string) {
    return this.raffleService.disbandRaffle(id);
  }

  @Get(':id/events')
  @Roles('ADMIN')
  findEvents(@Param('id', ParseUUIDPipe) id: string): Promise<RaffleEvent[]> {
    return this.raffleService.findEvents(id);
  }
}
