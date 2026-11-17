import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import { CurrentCompanyId } from '../common/decorators/current-company-id.decorator.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto.js';
import { SectionGuard } from '../auth/guards/section.guard.js';
import { RequireSection } from '../auth/decorators/section.decarator.js';
import { EmployeeAttendanceQueryDto } from './dto/employee-attendance-query.dto.js';
import { EmployeeSalaryQueryDto } from './dto/employee-salary-query.dto.js';

@UseGuards(JwtAuthGuard, SectionGuard, PermissionsGuard)
@RequireSection('hr')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequirePermissions(Permission.USERS_CREATE)
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.employeesService.create(dto, companyId);
  }

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  getAll(
    @CurrentCompanyId() companyId: string,
    @Query() query: EmployeeListQueryDto,
  ) {
    return this.employeesService.getAll(companyId, query);
  }

  @Post('import/verifix')
  @RequirePermissions(Permission.USERS_CREATE, Permission.USERS_UPDATE)
  importFromVerifix(@CurrentCompanyId() companyId: string) {
    return this.employeesService.importFromVerifix(companyId);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_READ)
  getById(@Param('id') id: string, @CurrentCompanyId() companyId: string) {
    return this.employeesService.getDetails(id, companyId);
  }

  @Get(':id/attendance')
  @RequirePermissions(Permission.USERS_READ)
  getAttendance(
    @Param('id') id: string,
    @CurrentCompanyId() companyId: string,
    @Query() query: EmployeeAttendanceQueryDto,
  ) {
    return this.employeesService.getAttendance(id, companyId, query);
  }

  @Get(':id/salary')
  @RequirePermissions(Permission.USERS_READ)
  getSalary(
    @Param('id') id: string,
    @CurrentCompanyId() companyId: string,
    @Query() query: EmployeeSalaryQueryDto,
  ) {
    return this.employeesService.getSalary(id, companyId, query);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.employeesService.update(id, dto, companyId);
  }

  @Post(':id/sync')
  @RequirePermissions(Permission.USERS_UPDATE)
  syncToVerifix(
    @Param('id') id: string,
    @CurrentCompanyId() companyId: string,
  ) {
    return this.employeesService.syncToVerifix(id, companyId);
  }
}
