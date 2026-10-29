import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema.js';
import { EmployeesService } from './employees.service.js';
import { EmployeesController } from './employees.controller.js';
import { UsersModule } from '../users/users.module.js';
import { VerifixModule } from '../verifix/verifix.module.js';
import { SystemEmployeesController } from './system-employees.controller.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Employee.name,
        schema: EmployeeSchema,
      },
    ]),
    UsersModule,
    VerifixModule,
    CompaniesModule,
  ],
  controllers: [EmployeesController, SystemEmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService, MongooseModule],
})
export class EmployeesModule {}
