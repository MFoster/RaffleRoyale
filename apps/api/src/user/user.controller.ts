import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import {
  PublicProfile,
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

  @Get(':id/profile')
  @Public()
  getPublicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicProfile> {
    return this.userService.getPublicProfile(id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<PublicUser> {
    this.assertCanAccessUser(id, auth);
    return this.userService.findOne(id);
  }

  @Patch(':id')
  updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<PublicUser> {
    this.assertCanAccessUser(id, auth);
    return this.userService.updateProfile(id, updateUserProfileDto);
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
