import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MoyskladClient } from '../moysklad/moysklad.client.js';
import {
  BranchSalesType,
  type SalesSummaryQueryDto,
} from './dto/sales-summary-query.dto.js';
import {
  SalesSummaryCache,
  SalesSummaryCacheDocument,
} from './schemas/sales-summary-cache.schema.js';
import type { SalesSummaryResponse } from './types/sales-summary.type.js';
import {
  BranchSalesPlan,
  BranchSalesPlanDocument,
} from './schemas/branch-sales-plan.schema.js';
import { MoyskladSyncService } from '../moysklad-sync/moysklad-sync.service.js';

const MILLISECONDS_PER_DAY = 86_400_000;
const CURRENT_PERIOD_CACHE_MS = 5 * 60_000;
const CLOSED_PERIOD_CACHE_MS = 24 * 60 * 60_000;
const MAX_PERIOD_DAYS = 366;

type BranchSummaryItem = {
  id: string;
  name: string;
  monthlyPlan: number;
  result: number;
};

@Injectable()
export class SalesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SalesService.name);
  private readonly pendingRefreshes = new Map<
    string,
    Promise<SalesSummaryResponse>
  >();

  constructor(
    private readonly moyskladClient: MoyskladClient,
    private readonly moyskladSyncService: MoyskladSyncService,
    @InjectModel(SalesSummaryCache.name)
    private readonly salesSummaryCacheModel: Model<SalesSummaryCacheDocument>,

    @InjectModel(BranchSalesPlan.name)
    private readonly branchSalesPlanModel: Model<BranchSalesPlanDocument>,
  ) {}

  onApplicationBootstrap() {
    const previousMonth = this.getPreviousMonthRange();

    void this.getSummary(previousMonth).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        'O‘tgan oy savdo cache’ini tayyorlab bo‘lmadi: ' + message,
      );
    });
  }

  async getSummary(query: SalesSummaryQueryDto): Promise<SalesSummaryResponse> {
    this.validatePeriod(query);

    const cacheKey = this.createCacheKey(query);
    const cached = await this.salesSummaryCacheModel
      .findOne({ cacheKey })
      .lean()
      .exec();

    if (cached) {
      if (cached.refreshAfter.getTime() <= Date.now()) {
        void this.refreshOnce(query, cacheKey).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            'Savdo cache’ini backgroundda yangilab bo‘lmadi (' +
              cacheKey +
              '): ' +
              message,
          );
        });
      }

      return cached.data;
    }

    return this.refreshOnce(query, cacheKey);
  }

  async getBranchesSummary(
    query: SalesSummaryQueryDto,
  ): Promise<BranchSummaryItem[]> {
    this.validatePeriod(query);

    return this.calculateBranchesSummary(query);
  }

  async upsertBranchPlan(retailStoreId: string, month: string, amount: number) {
    const plan = await this.branchSalesPlanModel
      .findOneAndUpdate(
        {
          retailStoreId,
          month,
        },
        {
          $set: {
            amount,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .lean()
      .exec();

    return plan;
  }

  private async calculateBranchesSummary(
    query: SalesSummaryQueryDto,
  ): Promise<BranchSummaryItem[]> {
    const month = query.from.slice(0, 7);
    const salesType = query.type ?? BranchSalesType.ALL;

    const [totals, plans] = await Promise.all([
      this.moyskladSyncService.getBranchPeriodTotals(query.from, query.to),
      this.branchSalesPlanModel.find({ month }).lean().exec(),
    ]);

    const getResultMinor = (total: (typeof totals)[number]) => {
      switch (salesType) {
        case BranchSalesType.RETAIL:
          return total.retailSalesMinor;

        case BranchSalesType.SHIPMENT:
          return total.shipmentSalesMinor;

        case BranchSalesType.ALL:
        default:
          return total.salesMinor;
      }
    };

    const nonZeroTotals = totals.filter((total) => getResultMinor(total) !== 0);

    const resultByStoreId = new Map(
      nonZeroTotals.map((total) => [
        total.retailStoreId,
        getResultMinor(total),
      ]),
    );

    const planByStoreId = new Map(
      plans.map((plan) => [plan.retailStoreId, plan.amount]),
    );

    const stores = await this.moyskladSyncService.getRetailStoresByIds(
      nonZeroTotals.map((total) => total.retailStoreId),
    );

    return stores.map((store) => ({
      id: store.moyskladId,
      name: store.name,

      monthlyPlan: planByStoreId.get(store.moyskladId) ?? 0,

      result: Number(
        ((resultByStoreId.get(store.moyskladId) ?? 0) / 100).toFixed(2),
      ),
    }));
  }

  private refreshOnce(
    query: SalesSummaryQueryDto,
    cacheKey: string,
  ): Promise<SalesSummaryResponse> {
    const pending = this.pendingRefreshes.get(cacheKey);

    if (pending) {
      return pending;
    }

    const refresh = this.refreshSummary(query, cacheKey).finally(() => {
      this.pendingRefreshes.delete(cacheKey);
    });

    this.pendingRefreshes.set(cacheKey, refresh);

    return refresh;
  }

  private async refreshSummary(
    query: SalesSummaryQueryDto,
    cacheKey: string,
  ): Promise<SalesSummaryResponse> {
    const data = await this.calculateSummary(query);
    const now = new Date();
    const refreshAfter = new Date(now.getTime() + this.getCacheDuration(query));

    await this.salesSummaryCacheModel
      .findOneAndUpdate(
        { cacheKey },
        {
          $set: {
            cacheKey,
            from: query.from,
            to: query.to,
            data,
            syncedAt: now,
            refreshAfter,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return data;
  }

  private async calculateSummary(
    query: SalesSummaryQueryDto,
  ): Promise<SalesSummaryResponse> {
    const [wholesaleSales, retailSales, wholesaleReturns, retailReturns] =
      await Promise.all([
        this.moyskladClient.summarizeDocuments('demand', query.from, query.to),
        this.moyskladClient.summarizeDocuments(
          'retaildemand',
          query.from,
          query.to,
        ),
        this.moyskladClient.summarizeDocuments(
          'salesreturn',
          query.from,
          query.to,
        ),
        this.moyskladClient.summarizeDocuments(
          'retailsalesreturn',
          query.from,
          query.to,
        ),
      ]);

    const grossSales = this.addAmounts(
      wholesaleSales.amount,
      retailSales.amount,
    );
    const returns = this.addAmounts(
      wholesaleReturns.amount,
      retailReturns.amount,
    );
    const netSales = this.addAmounts(grossSales, -returns);

    return {
      period: {
        from: query.from,
        to: query.to,
        timezone: 'Asia/Tashkent',
      },
      summary: {
        grossSales,
        returns,
        netSales,
        salesDocumentCount: wholesaleSales.count + retailSales.count,
        returnDocumentCount: wholesaleReturns.count + retailReturns.count,
      },
      breakdown: {
        wholesale: {
          sales: wholesaleSales.amount,
          returns: wholesaleReturns.amount,
          netSales: this.addAmounts(
            wholesaleSales.amount,
            -wholesaleReturns.amount,
          ),
          salesDocumentCount: wholesaleSales.count,
          returnDocumentCount: wholesaleReturns.count,
        },
        retail: {
          sales: retailSales.amount,
          returns: retailReturns.amount,
          netSales: this.addAmounts(retailSales.amount, -retailReturns.amount),
          salesDocumentCount: retailSales.count,
          returnDocumentCount: retailReturns.count,
        },
      },
      currency: {
        code: 'UZS',
        precision: 2,
      },
      source: 'moysklad',
    };
  }

  private validatePeriod(query: SalesSummaryQueryDto) {
    const fromDate = this.parseDate(query.from, 'from');
    const toDate = this.parseDate(query.to, 'to');

    if (fromDate > toDate) {
      throw new BadRequestException(
        'from sanasi to sanasidan keyin bo‘lishi mumkin emas',
      );
    }

    const periodDays =
      Math.floor(
        (toDate.getTime() - fromDate.getTime()) / MILLISECONDS_PER_DAY,
      ) + 1;

    if (periodDays > MAX_PERIOD_DAYS) {
      throw new BadRequestException(
        'Savdo hisoboti ' + MAX_PERIOD_DAYS + ' kundan oshmasligi kerak',
      );
    }
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value + 'T00:00:00.000Z');

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(field + ' haqiqiy sana bo‘lishi kerak');
    }

    return date;
  }

  private createCacheKey(query: SalesSummaryQueryDto): string {
    return 'global:' + query.from + ':' + query.to;
  }

  private getCacheDuration(query: SalesSummaryQueryDto): number {
    const currentMonth = this.getTashkentYearMonth();
    const includesCurrentMonth = query.to.slice(0, 7) === currentMonth;

    return includesCurrentMonth
      ? CURRENT_PERIOD_CACHE_MS
      : CLOSED_PERIOD_CACHE_MS;
  }

  private getTashkentYearMonth(): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find(({ type }) => type === 'year')?.value;
    const month = parts.find(({ type }) => type === 'month')?.value;

    return year + '-' + month;
  }

  private getPreviousMonthRange(): SalesSummaryQueryDto {
    const [currentYear, currentMonth] = this.getTashkentYearMonth()
      .split('-')
      .map(Number);
    let year = currentYear;
    let month = currentMonth - 1;

    if (month === 0) {
      year -= 1;
      month = 12;
    }

    const monthValue = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
      from: year + '-' + monthValue + '-01',
      to: year + '-' + monthValue + '-' + String(lastDay).padStart(2, '0'),
    };
  }

  private addAmounts(...amounts: number[]): number {
    const total = amounts.reduce((result, amount) => result + amount, 0);

    return Number(total.toFixed(2));
  }
}
