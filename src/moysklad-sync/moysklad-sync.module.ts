import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MoyskladModule } from '../moysklad/moysklad.module.js';
import {
  BranchDailySales,
  BranchDailySalesSchema,
} from './schema/branch-daily-sales.schema.js';
import { MoyskladSyncService } from './moysklad-sync.service.js';
import { MoyskladSyncController } from './moysklad-sync.controller.js';
import {
  MoyskladRetailStore,
  MoyskladRetailStoreSchema,
} from './schema/moysklad-retail-store.schema.js';
import { MoyskladSyncScheduler } from './moysklad-sync.scheduler.js';
import {
  BranchProductStat,
  BranchProductStatSchema,
} from './schema/branch-product-stat.schema.js';

@Module({
  imports: [
    MoyskladModule,

    MongooseModule.forFeature([
      {
        name: BranchDailySales.name,
        schema: BranchDailySalesSchema,
      },
      {
        name: MoyskladRetailStore.name,
        schema: MoyskladRetailStoreSchema,
      },
      {
        name: BranchProductStat.name,
        schema: BranchProductStatSchema,
      },
    ]),
  ],

  providers: [MoyskladSyncService, MoyskladSyncScheduler],
  exports: [MoyskladSyncService, MongooseModule],
  controllers: [MoyskladSyncController],
})
export class MoyskladSyncModule {}
