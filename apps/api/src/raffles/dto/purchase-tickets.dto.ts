import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class PurchaseTicketsDto {
  @IsUUID()
  buyerId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}
