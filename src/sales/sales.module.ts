import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoyskladModule } from '../moysklad/moysklad.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import {
  SalesSummaryCache,
  SalesSummaryCacheSchema,
} from './schemas/sales-summary-cache.schema.js';
import {
  BranchSalesPlan,
  BranchSalesPlanSchema,
} from './schemas/branch-sales-plan.schema.js';
import { MoyskladSyncModule } from '../moysklad-sync/moysklad-sync.module.js';
import { CompaniesModule } from '../companies/companies.module.js';

@Module({
  imports: [
    MoyskladModule,
    MoyskladSyncModule,
    CompaniesModule,
    MongooseModule.forFeature([
      {
        name: SalesSummaryCache.name,
        schema: SalesSummaryCacheSchema,
      },
      {
        name: BranchSalesPlan.name,
        schema: BranchSalesPlanSchema,
      },
    ]),
  ],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
