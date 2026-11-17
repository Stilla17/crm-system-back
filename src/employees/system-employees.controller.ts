import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type.js';
import { EmployeesService } from './employees.service.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { MoveEmployeeCompanyDto } from './dto/move-employee-company.dto.js';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto.js';
import { EmployeeAttendanceQueryDto } from './dto/employee-attendance-query.dto.js';
import { EmployeeSalaryQueryDto } from './dto/employee-salary-query.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SystemEmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('companies/:companyId/employees')
  @RequirePermissions(Permission.USERS_READ)
  getCompanyEmployees(
    @Param('companyId') companyId: string,
    @Query() query: EmployeeListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);

    return this.employeesService.getAll(companyId, query);
  }

  @Get('companies/:companyId/employees/:employeeId')
  @RequirePermissions(Permission.USERS_READ)
  getCompanyEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.getDetails(employeeId, companyId);
  }

  @Get('companies/:companyId/employees/:employeeId/attendance')
  @RequirePermissions(Permission.USERS_READ)
  getCompanyEmployeeAttendance(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Query() query: EmployeeAttendanceQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.getAttendance(employeeId, companyId, query);
  }

  @Get('companies/:companyId/employees/:employeeId/salary')
  @RequirePermissions(Permission.USERS_READ)
  getCompanyEmployeeSalary(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Query() query: EmployeeSalaryQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.getSalary(employeeId, companyId, query);
  }

  @Get('system/employees')
  @RequirePermissions(Permission.USERS_READ)
  getAllEmployees(
    @Query() query: EmployeeListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);

    return this.employeesService.getAllForSystem(query);
  }

  @Patch('companies/:companyId/employees/:employeeId')
  @RequirePermissions(Permission.USERS_UPDATE)
  updateCompanyEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.update(employeeId, dto, companyId);
  }

  @Patch('companies/:companyId/employees/:employeeId/company')
  @RequirePermissions(Permission.USERS_UPDATE)
  moveCompanyEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: MoveEmployeeCompanyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.moveToCompany(
      employeeId,
      companyId,
      dto.targetCompanyId,
    );
  }

  @Post('companies/:companyId/employees/import/verifix')
  @RequirePermissions(Permission.USERS_CREATE, Permission.USERS_UPDATE)
  importCompanyEmployees(
    @Param('companyId') companyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.importFromVerifix(companyId);
  }

  @Post('companies/:companyId/employees/:employeeId/sync')
  @RequirePermissions(Permission.USERS_UPDATE)
  syncCompanyEmployee(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.ensureSystemUser(req);
    return this.employeesService.syncToVerifix(employeeId, companyId);
  }

  private ensureSystemUser(req: AuthenticatedRequest) {
    if (req.user.roleScope !== RoleScope.SYSTEM) {
      throw new ForbiddenException(
        'Bu endpointdan faqat Super Admin foydalana oladi',
      );
    }
  }
}
