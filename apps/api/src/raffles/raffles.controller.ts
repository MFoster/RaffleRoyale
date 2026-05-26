import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Raffle } from '@prisma/client';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { RafflesService } from './raffles.service';

@Controller('raffles')
export class RafflesController {
  constructor(private readonly rafflesService: RafflesService) {}

  @Post()
  create(@Body() createRaffleDto: CreateRaffleDto): Promise<Raffle> {
    return this.rafflesService.create(createRaffleDto);
  }

  @Get()
  findAll(): Promise<Raffle[]> {
    return this.rafflesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Raffle> {
    return this.rafflesService.findOne(id);
  }
}
