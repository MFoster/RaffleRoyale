import { ItemType, RaffleStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsDateString,
  IsEnum,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];

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
