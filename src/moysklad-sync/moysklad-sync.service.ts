import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { MoyskladClient } from '../moysklad/moysklad.client.js';
import type { MoyskladRetailStore as MoyskladRetailStoreResponse } from '../moysklad/types/moysklad-document.type.js';

import { BranchDailySales } from './schema/branch-daily-sales.schema.js';
import { MoyskladRetailStore } from './schema/moysklad-retail-store.schema.js';

type DailyTotal = {
  retailStoreId: string;
  date: string;
  salesMinor: number;
  retailSalesMinor: number;
  shipmentSalesMinor: number;
  returnsMinor: number;
  salesDocumentCount: number;
  returnDocumentCount: number;
};

@Injectable()
export class MoyskladSyncService {
  private readonly logger = new Logger(MoyskladSyncService.name);

  private readonly pendingSyncs = new Map<string, Promise<SyncRangeResult>>();

  constructor(
    private readonly moyskladClient: MoyskladClient,

    @InjectModel(BranchDailySales.name)
    private readonly branchDailySalesModel: Model<BranchDailySales>,

    @InjectModel(MoyskladRetailStore.name)
    private readonly retailStoreModel: Model<MoyskladRetailStore>,
  ) {}

  syncRange(from: string, to: string): Promise<SyncRangeResult> {
    const syncKey = `${from}:${to}`;
    const pending = this.pendingSyncs.get(syncKey);

    if (pending) {
      return pending;
    }

    const sync = this.performSyncRange(from, to).finally(() => {
      this.pendingSyncs.delete(syncKey);
    });

    this.pendingSyncs.set(syncKey, sync);

    return sync;
  }

  private async syncRetailStores(
    stores: MoyskladRetailStoreResponse[],
  ): Promise<void> {
    const syncedAt = new Date();
    const activeStoreIds = stores.map((store) => store.id);

    if (activeStoreIds.length > 0) {
      await this.retailStoreModel
        .updateMany(
          {
            moyskladId: {
              $nin: activeStoreIds,
            },
          },
          {
            $set: {
              archived: true,
              syncedAt,
            },
          },
        )
        .exec();
    }

    if (stores.length === 0) {
      return;
    }

    await this.retailStoreModel.bulkWrite(
      stores.map((store) => ({
        updateOne: {
          filter: {
            moyskladId: store.id,
          },
          update: {
            $set: {
              name: store.name,
              archived: store.archived,
              externalCode: store.externalCode,
              storeHref: store.store.meta.href,
              syncedAt,
            },
          },
          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );
  }

  private async loadDailyTotalsFromReports(
    retailStores: MoyskladRetailStoreResponse[],
    from: string,
    to: string,
  ): Promise<DailyTotal[]> {
    const dailyTotals: DailyTotal[] = [];

    // Har bir filial 2 ta report so‘rovi yuboradi.
    // Bir vaqtning o‘zida jami 4 ta MoySklad so‘rovi ishlaydi.
    const concurrency = 2;

    const storesWithWarehouse = retailStores.filter(
      (store) => store.store?.meta.href,
    );

    for (
      let index = 0;
      index < storesWithWarehouse.length;
      index += concurrency
    ) {
      const currentStores = storesWithWarehouse.slice(
        index,
        index + concurrency,
      );

      const currentResults = await Promise.all(
        currentStores.map(async (store) => {
          const [allSeries, retailSeries] = await Promise.all([
            this.moyskladClient.getSalesPlotSeriesByStore(
              store.store.meta.href,
              from,
              to,
            ),
            this.moyskladClient.getSalesPlotSeriesByRetailStore(
              store.id,
              from,
              to,
            ),
          ]);

          const allByDate = new Map(
            allSeries.map((item) => [
              item.date.slice(0, 10),
              Math.round(item.sum),
            ]),
          );

          const retailByDate = new Map(
            retailSeries.map((item) => [
              item.date.slice(0, 10),
              Math.round(item.sum),
            ]),
          );

          const dates = new Set([...allByDate.keys(), ...retailByDate.keys()]);

          return Array.from(dates)
            .map((date): DailyTotal => {
              const salesMinor = allByDate.get(date) ?? 0;
              const retailSalesMinor = retailByDate.get(date) ?? 0;

              return {
                retailStoreId: store.id,
                date,

                salesMinor,
                retailSalesMinor,
                shipmentSalesMinor: Math.max(salesMinor - retailSalesMinor, 0),

                returnsMinor: 0,
                salesDocumentCount: 0,
                returnDocumentCount: 0,
              };
            })
            .filter(
              (item) => item.salesMinor !== 0 || item.retailSalesMinor !== 0,
            );
        }),
      );

      dailyTotals.push(...currentResults.flat());
    }

    return dailyTotals;
  }

  private async performSyncRange(
    from: string,
    to: string,
  ): Promise<SyncRangeResult> {
    this.logger.log(`MoySklad sync boshlandi: ${from} — ${to}`);

    const retailStores = await this.moyskladClient.listAllRetailStores();

    await this.syncRetailStores(retailStores);

    const dailyTotals = await this.loadDailyTotalsFromReports(
      retailStores,
      from,
      to,
    );

    await this.branchDailySalesModel
      .deleteMany({
        date: {
          $gte: from,
          $lte: to,
        },
      })
      .exec();

    if (dailyTotals.length > 0) {
      const syncedAt = new Date();

      await this.branchDailySalesModel.bulkWrite(
        dailyTotals.map((total) => ({
          updateOne: {
            filter: {
              retailStoreId: total.retailStoreId,
              date: total.date,
            },
            update: {
              $set: {
                ...total,
                netSalesMinor: total.salesMinor - total.returnsMinor,
                syncedAt,
              },
            },
            upsert: true,
          },
        })),
        {
          ordered: false,
        },
      );
    }

    const result = {
      from,
      to,
      retailStoreCount: retailStores.length,
      dailyRecordCount: dailyTotals.length,
      syncedAt: new Date(),
    };

    this.logger.log(`MoySklad sync tugadi: ${JSON.stringify(result)}`);

    return result;
  }

  async getRetailStoresByIds(
    retailStoreIds: string[],
  ): Promise<SyncedRetailStore[]> {
    if (retailStoreIds.length === 0) {
      return [];
    }

    const stores = await this.retailStoreModel
      .find({
        moyskladId: {
          $in: retailStoreIds,
        },
        archived: false,
      })
      .select({
        _id: 0,
        moyskladId: 1,
        name: 1,
        storeHref: 1,
      })
      .lean()
      .exec();

    return stores;
  }

  async getBranchPeriodTotals(
    from: string,
    to: string,
  ): Promise<BranchPeriodTotal[]> {
    const rows = await this.branchDailySalesModel.aggregate<{
      _id: string;
      salesMinor: number;
      retailSalesMinor: number;
      shipmentSalesMinor: number;
      returnsMinor: number;
      netSalesMinor: number;
    }>([
      {
        $match: {
          date: {
            $gte: from,
            $lte: to,
          },
        },
      },
      {
        $group: {
          _id: '$retailStoreId',

          salesMinor: {
            $sum: '$salesMinor',
          },

          retailSalesMinor: {
            $sum: '$retailSalesMinor',
          },

          shipmentSalesMinor: {
            $sum: '$shipmentSalesMinor',
          },

          returnsMinor: {
            $sum: '$returnsMinor',
          },

          netSalesMinor: {
            $sum: '$netSalesMinor',
          },
        },
      },
    ]);

    return rows.map((row) => ({
      retailStoreId: row._id,
      salesMinor: row.salesMinor,
      retailSalesMinor: row.retailSalesMinor,
      shipmentSalesMinor: row.shipmentSalesMinor,
      returnsMinor: row.returnsMinor,
      netSalesMinor: row.netSalesMinor,
    }));
  }
}

export type SyncRangeResult = {
  from: string;
  to: string;
  retailStoreCount: number;
  dailyRecordCount: number;
  syncedAt: Date;
};

export type BranchPeriodTotal = {
  retailStoreId: string;
  salesMinor: number;
  retailSalesMinor: number;
  shipmentSalesMinor: number;
  returnsMinor: number;
  netSalesMinor: number;
};

export type SyncedRetailStore = {
  moyskladId: string;
  name: string;
  storeHref: string;
};
