import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from './schemas/company.schema.js';
import { CompaniesController } from './companies.controller.js';
import { PassportModule } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Company.name,
        schema: CompanySchema,
      },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, PermissionsGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
