import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { AuthRole } from '../auth.types';

export class RequestTokenDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: AuthRole;
}
