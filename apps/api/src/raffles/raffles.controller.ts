import {
  BadRequestException,
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
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
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
import { RafflesService } from './raffles.service';

const MAX_RAFFLE_IMAGE_UPLOADS = 3;
const MAX_RAFFLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const RAFFLE_UPLOADS_DIRECTORY = join(process.cwd(), 'uploads', 'raffles');

mkdirSync(RAFFLE_UPLOADS_DIRECTORY, { recursive: true });

@Controller('raffles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RafflesController {
  constructor(private readonly rafflesService: RafflesService) {}

  @Post('process-expired')
  @Roles('ADMIN')
  processExpiredRaffles() {
    return this.rafflesService.processExpiredRaffles();
  }

  @Post()
  create(
    @Body() createRaffleDto: CreateRaffleDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<Raffle> {
    if (auth.role !== 'ADMIN' && auth.userId !== createRaffleDto.rafflerId) {
      throw new ForbiddenException('Cannot create raffle for another user');
    }

    return this.rafflesService.create(createRaffleDto);
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
  ): Promise<{ imageUrls: string[] }> {
    if (files.length === 0) {
      throw new BadRequestException('Upload at least one image file.');
    }

    if (files.some((file) => !file.mimetype.startsWith('image/'))) {
      throw new BadRequestException('Only image files are allowed.');
    }

    const imageUrls = await Promise.all(
      files.map(async (file) => {
        const fileExtension = extname(file.originalname).toLowerCase();
        const safeExtension = fileExtension.length > 0 ? fileExtension : '.png';
        const fileName = `${Date.now().toString(36)}-${randomUUID()}${safeExtension}`;

        await writeFile(join(RAFFLE_UPLOADS_DIRECTORY, fileName), file.buffer);
        return `/api/uploads/raffles/${fileName}`;
      }),
    );

    return {
      imageUrls,
    };
  }

  @Get()
  @Public()
  findAll(): Promise<Raffle[]> {
    return this.rafflesService.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Raffle> {
    return this.rafflesService.findOne(id);
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

    return this.rafflesService.purchaseTickets(id, purchaseTicketsDto);
  }

  @Post(':id/resolve-winner')
  @Roles('ADMIN')
  resolveWinner(@Param('id', ParseUUIDPipe) id: string) {
    return this.rafflesService.resolveWinner(id);
  }

  @Post(':id/disband')
  @Roles('ADMIN')
  disband(@Param('id', ParseUUIDPipe) id: string) {
    return this.rafflesService.disbandRaffle(id);
  }

  @Get(':id/events')
  @Roles('ADMIN')
  findEvents(@Param('id', ParseUUIDPipe) id: string): Promise<RaffleEvent[]> {
    return this.rafflesService.findEvents(id);
  }
}
