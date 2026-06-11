import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Raffle } from '@prisma/client';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import {
  PublicUser,
  UserTicketActivityItem,
  UserService,
} from './user.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('user')
@ApiTags('user')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Public()
  create(@Body() createUserDto: CreateUserDto): Promise<PublicUser> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Roles('ADMIN')
  findAll(): Promise<PublicUser[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<PublicUser> {
    this.assertCanAccessUser(id, auth);
    return this.userService.findOne(id);
  }

  @Get(':id/tickets')
  findTicketActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<UserTicketActivityItem[]> {
    this.assertCanAccessUser(id, auth);
    return this.userService.findTicketActivity(id);
  }

  @Get(':id/activity')
  findActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<UserTicketActivityItem[]> {
    this.assertCanAccessUser(id, auth);
    return this.userService.findTicketActivity(id);
  }

  @Get(':id/raffle')
  findUserRaffles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<Raffle[]> {
    this.assertCanAccessUser(id, auth);
    return this.userService.findUserRaffles(id);
  }

  private assertCanAccessUser(id: string, auth: AuthContext): void {
    if (auth.role !== 'ADMIN' && auth.userId !== id) {
      throw new ForbiddenException('Cannot view another user profile');
    }
  }
}
