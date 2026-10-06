import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';

@Module({
  providers: [CompaniesService]
})
export class CompaniesModule {}
