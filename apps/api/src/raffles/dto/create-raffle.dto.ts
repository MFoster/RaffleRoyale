import { ItemType, RaffleStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateRaffleDto {
  @IsUUID()
  rafflerId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ItemType)
  itemType: ItemType = ItemType.PHYSICAL;

  @IsInt()
  @Min(1)
  totalTickets: number;

  @IsInt()
  @Min(1)
  ticketPrice: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(95)
  minSellThrough?: number;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsEnum(RaffleStatus)
  status?: RaffleStatus;
}
