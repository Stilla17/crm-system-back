import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentCompanyId } from '../common/decorators/current-company-id.decorator.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions('roles.create')
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentCompanyId()
    companyId: string,
  ) {
    return this.rolesService.createRole(dto, companyId);
  }

  @Get()
  @RequirePermissions('roles.read')
  getAllRoles(
    @CurrentCompanyId()
    companyId: string,
  ) {
    return this.rolesService.getAllRoles(companyId);
  }

  @Get(':id')
  @RequirePermissions('roles.read')
  getRoleById(
    @Param('id') id: string,
    @CurrentCompanyId()
    companyId: string,
  ) {
    return this.rolesService.getRoleById(id, companyId);
  }

  @Patch(':id')
  @RequirePermissions('roles.update')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentCompanyId()
    companyId: string,
  ) {
    return this.rolesService.updateRole(id, dto, companyId);
  }
}
