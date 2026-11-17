import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoyskladModule } from '../moysklad/moysklad.module.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import {
  SalesSummaryCache,
  SalesSummaryCacheSchema,
} from './schemas/sales-summary-cache.schema.js';

@Module({
  imports: [
    MoyskladModule,
    MongooseModule.forFeature([
      {
        name: SalesSummaryCache.name,
        schema: SalesSummaryCacheSchema,
      },
    ]),
  ],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
