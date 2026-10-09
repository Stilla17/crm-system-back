import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';
import { CurrentCompanyId } from '../common/decorators/current-company-id.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  getAllUsers(@CurrentCompanyId() companyId: string) {
    return this.userService.getAllUsers(companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_READ)
  getUserById(@Param('id') id: string, @CurrentCompanyId() companyId: string) {
    return this.userService.getUserByIdForCompany(id, companyId);
  }

  @Post()
  @RequirePermissions(Permission.USERS_CREATE)
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.userService.createUser(dto, companyId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_UPDATE)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.userService.updateUser(id, dto, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.USERS_DELETE)
  deleteUser(@Param('id') id: string, @CurrentCompanyId() companyId: string) {
    return this.userService.deleteUser(id, companyId);
  }
}
