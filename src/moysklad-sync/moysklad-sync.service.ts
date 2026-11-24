import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomUUID } from 'crypto';

import { MoyskladClient } from '../moysklad/moysklad.client.js';
import type { MoyskladRetailStore as MoyskladRetailStoreResponse } from '../moysklad/types/moysklad-document.type.js';

import { BranchDailySales } from './schema/branch-daily-sales.schema.js';
import { MoyskladRetailStore } from './schema/moysklad-retail-store.schema.js';
import { BranchProductStat } from './schema/branch-product-stat.schema.js';

const DAY_MS = 86_400_000;
const PRODUCT_SYNC_DAYS = 90;
const PRODUCT_BULK_SIZE = 1000;
const PRODUCT_SYNC_INTERVAL_DAYS = 3;

const tashkentDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatTashkentDate(date: Date): string {
  return tashkentDateFormatter.format(date);
}

function parseMoyskladMoment(moment: string): Date {
  return new Date(moment.replace(' ', 'T') + '+05:00');
}

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
  private readonly pendingProductSyncs = new Map<
    string,
    Promise<ProductSyncResult>
  >();

  constructor(
    private readonly moyskladClient: MoyskladClient,

    @InjectModel(BranchDailySales.name)
    private readonly branchDailySalesModel: Model<BranchDailySales>,

    @InjectModel(MoyskladRetailStore.name)
    private readonly retailStoreModel: Model<MoyskladRetailStore>,

    @InjectModel(BranchProductStat.name)
    private readonly branchProductStatModel: Model<BranchProductStat>,
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

  syncBranchProducts(
    retailStoreId?: string,
    limit?: number,
  ): Promise<ProductSyncResult> {
    const syncKey = `${retailStoreId ?? 'all'}:${limit ?? 'full'}`;
    const pending = this.pendingProductSyncs.get(syncKey);

    if (pending) {
      return pending;
    }

    if (this.pendingProductSyncs.size > 0) {
      throw new ConflictException(
        'Boshqa filial mahsulotlari sync jarayoni davom etmoqda',
      );
    }

    const sync = this.performProductSync(retailStoreId, limit).finally(() => {
      this.pendingProductSyncs.delete(syncKey);
    });

    this.pendingProductSyncs.set(syncKey, sync);

    return sync;
  }

  async isBranchProductSyncDue(now = new Date()): Promise<boolean> {
    const oldestActiveProduct = await this.branchProductStatModel
      .findOne({ isActive: true })
      .select({ _id: 0, syncedAt: 1 })
      .sort({ syncedAt: 1 })
      .lean()
      .exec();

    if (!oldestActiveProduct?.syncedAt) {
      return true;
    }

    const lastSyncDate = Date.parse(
      `${formatTashkentDate(oldestActiveProduct.syncedAt)}T00:00:00.000Z`,
    );
    const currentDate = Date.parse(`${formatTashkentDate(now)}T00:00:00.000Z`);

    return (currentDate - lastSyncDate) / DAY_MS >= PRODUCT_SYNC_INTERVAL_DAYS;
  }

  private async performProductSync(
    retailStoreId?: string,
    limit?: number,
  ): Promise<ProductSyncResult> {
    const stores = await this.moyskladClient.listAllRetailStores();
    await this.syncRetailStores(stores);

    const targetStores = retailStoreId
      ? stores.filter((store) => store.id === retailStoreId)
      : stores;

    if (retailStoreId && targetStores.length === 0) {
      throw new Error(`MoySklad filiali topilmadi: ${retailStoreId}`);
    }

    const to = formatTashkentDate(new Date());
    const from = formatTashkentDate(
      new Date(Date.now() - (PRODUCT_SYNC_DAYS - 1) * DAY_MS),
    );
    const branches: ProductSyncResult['branches'] = [];

    for (const store of targetStores) {
      try {
        const branchResult = await this.syncSingleBranchProducts(
          store.id,
          store.store.meta.href,
          from,
          to,
          limit,
        );

        branches.push({
          retailStoreId: store.id,
          name: store.name,
          ...branchResult,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Filial mahsulotlari sync xatosi (${store.name}): ${message}`,
        );
        branches.push({
          retailStoreId: store.id,
          name: store.name,
          productCount: 0,
          deactivatedCount: 0,
          error: message,
        });

        if (retailStoreId) {
          throw error;
        }
      }
    }

    return {
      from,
      to,
      branchCount: targetStores.length,
      productCount: branches.reduce(
        (total, branch) => total + branch.productCount,
        0,
      ),
      branches,
      syncedAt: new Date(),
    };
  }

  private async syncSingleBranchProducts(
    retailStoreId: string,
    storeHref: string,
    from: string,
    to: string,
    limit?: number,
  ): Promise<{ productCount: number; deactivatedCount: number }> {
    const syncId = randomUUID();
    const syncedAt = new Date();
    const cutoff30Days = formatTashkentDate(new Date(Date.now() - 29 * DAY_MS));
    const [products, sales] = await Promise.all([
      this.moyskladClient.getRetailStoreProducts(retailStoreId),
      this.moyskladClient.getProductSalesByStore(storeHref, from, to),
    ]);
    const receipts =
      await this.moyskladClient.getProductReceiptsByStore(storeHref);
    const selectedProducts = limit
      ? products
          .filter((product) => product.available > 0)
          .sort((left, right) => right.available - left.available)
          .slice(0, limit)
      : products;
    const salesByProductId = new Map<
      string,
      {
        lastSoldAt: Date;
        soldQuantity30Days: number;
        soldQuantity90Days: number;
      }
    >();
    const lastReceiptByProductId = new Map<string, Date>();

    for (const sale of sales) {
      const current = salesByProductId.get(sale.productId);
      const soldAt = parseMoyskladMoment(sale.moment);
      const saleDate = sale.moment.slice(0, 10);

      salesByProductId.set(sale.productId, {
        lastSoldAt:
          !current || soldAt > current.lastSoldAt ? soldAt : current.lastSoldAt,
        soldQuantity30Days:
          (current?.soldQuantity30Days ?? 0) +
          (saleDate >= cutoff30Days ? sale.quantity : 0),
        soldQuantity90Days: (current?.soldQuantity90Days ?? 0) + sale.quantity,
      });
    }

    for (const receipt of receipts) {
      const receivedAt = parseMoyskladMoment(receipt.moment);
      const current = lastReceiptByProductId.get(receipt.productId);

      if (!current || receivedAt > current) {
        lastReceiptByProductId.set(receipt.productId, receivedAt);
      }
    }

    for (
      let offset = 0;
      offset < selectedProducts.length;
      offset += PRODUCT_BULK_SIZE
    ) {
      const chunk = selectedProducts.slice(offset, offset + PRODUCT_BULK_SIZE);

      await this.branchProductStatModel.bulkWrite(
        chunk.map((product) => {
          const sale = salesByProductId.get(product.id);

          return {
            updateOne: {
              filter: {
                retailStoreId,
                productId: product.id,
              },
              update: {
                $set: {
                  productName: product.name,
                  code: product.code,
                  article: product.article,
                  productType: product.type,
                  stock: product.stock,
                  available: product.available,
                  inTransit: product.inTransit,
                  lastSoldAt: sale?.lastSoldAt ?? null,
                  lastReceivedAt:
                    lastReceiptByProductId.get(product.id) ?? null,
                  soldQuantity30Days: sale?.soldQuantity30Days ?? 0,
                  soldQuantity90Days: sale?.soldQuantity90Days ?? 0,
                  isActive: true,
                  lastSeenSyncId: syncId,
                  syncedAt,
                },
                $unset: {
                  inactiveAt: 1,
                },
              },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    }

    const deactivatedCount = limit
      ? 0
      : (
          await this.branchProductStatModel
            .updateMany(
              {
                retailStoreId,
                lastSeenSyncId: { $ne: syncId },
                isActive: true,
              },
              {
                $set: {
                  stock: 0,
                  available: 0,
                  inTransit: 0,
                  isActive: false,
                  inactiveAt: syncedAt,
                  syncedAt,
                },
              },
            )
            .exec()
        ).modifiedCount;

    return {
      productCount: selectedProducts.length,
      deactivatedCount,
    };
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

  async getAllActiveRetailStores(): Promise<SyncedRetailStore[]> {
    return this.retailStoreModel
      .find({ archived: false })
      .select({
        _id: 0,
        moyskladId: 1,
        name: 1,
        storeHref: 1,
      })
      .sort({ name: 1 })
      .lean()
      .exec();
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

export type ProductSyncResult = {
  from: string;
  to: string;
  branchCount: number;
  productCount: number;
  syncedAt: Date;
  branches: Array<{
    retailStoreId: string;
    name: string;
    productCount: number;
    deactivatedCount: number;
    error?: string;
  }>;
};
