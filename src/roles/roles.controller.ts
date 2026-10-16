import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';
import { RoleScope } from './enum/role-scope.enum.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions(Permission.ROLES_CREATE)
  createRole(@Body() dto: CreateRoleDto, @Req() req: AuthenticatedRequest) {
    this.ensureSystemUser(req);
    return this.rolesService.createRole(dto);
  }

  @Get()
  @RequirePermissions(Permission.ROLES_READ)
  getAllRoles() {
    return this.rolesService.getAllRoles();
  }

  @Get(':id')
  @RequirePermissions(Permission.ROLES_READ)
  getRoleById(@Param('id') id: string) {
    return this.rolesService.getRoleById(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ROLES_UPDATE)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.rolesService.updateRole(id, dto);
  }

  private ensureSystemUser(req: AuthenticatedRequest) {
    if (req.user.roleScope !== RoleScope.SYSTEM) {
      throw new ForbiddenException(
        'Global rollarni faqat Super Admin boshqara oladi',
      );
    }
  }
}
