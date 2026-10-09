import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companyService: CompaniesService) {}

  @Get()
  @RequirePermissions(Permission.COMPANIES_READ)
  getAllCompanies() {
    return this.companyService.getAllCompanies();
  }

  @Get(':id')
  @RequirePermissions(Permission.COMPANIES_READ)
  getCompanyById(@Param('id') id: string) {
    return this.companyService.getCompanyById(id);
  }

  @Post()
  @RequirePermissions(Permission.COMPANIES_CREATE)
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.companyService.createCompany(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COMPANIES_UPDATE)
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.updateCompany(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.COMPANIES_DELETE)
  deleteCompany(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (req.user.roleScope !== RoleScope.SYSTEM) {
      throw new ForbiddenException(
        "Kompaniyani faqat SuperAdmin o'chira oladi",
      );
    }
    return this.companyService.deleteCompany(id);
  }
}
