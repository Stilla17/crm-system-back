import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SystemUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('companies/:companyId/users')
  @RequirePermissions(Permission.USERS_READ)
  getCompanyUsers(
    @Param('companyId') companyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);

    return this.usersService.getAllUsers(companyId);
  }

  @Get('system/users')
  @RequirePermissions(Permission.USERS_READ)
  getAllUsers(@Req() req: AuthenticatedRequest) {
    this.ensureSystemUser(req);

    return this.usersService.getAllUsersForSystem();
  }

  @Post('companies/:companyId/users')
  @RequirePermissions(Permission.USERS_CREATE)
  createCompanyUser(
    @Param('companyId') companyId: string,
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.usersService.createUser(dto, companyId);
  }

  private ensureSystemUser(req: AuthenticatedRequest) {
    if (req.user.roleScope !== RoleScope.SYSTEM) {
      throw new ForbiddenException(
        'Bu endpointdan faqat Super Admin foydalana oladi',
      );
    }
  }
}
