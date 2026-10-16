import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import { RoleScope } from './enum/role-scope.enum.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SystemRolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Super Admin: barcha global rollar
  @Get('system/roles')
  @RequirePermissions(Permission.ROLES_READ)
  getAllRoles(@Req() req: AuthenticatedRequest) {
    this.ensureSystemUser(req);

    return this.rolesService.getAllRolesForSystem();
  }

  private ensureSystemUser(req: AuthenticatedRequest) {
    if (req.user.roleScope !== RoleScope.SYSTEM) {
      throw new ForbiddenException(
        'Bu endpointdan faqat Super Admin foydalana oladi',
      );
    }
  }
}
