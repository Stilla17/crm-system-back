import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { QueryFilter, SortOrder } from 'mongoose';
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
import { CompaniesService } from '../companies/companies.service.js';
import {
  BranchProductFilter,
  BranchProductSort,
  type BranchProductsQueryDto,
} from './dto/branch-products-query.dto.js';
import { BranchProductStat } from '../moysklad-sync/schema/branch-product-stat.schema.js';
import type { TransferRecommendationsQueryDto } from './dto/transfer-recommendations-query.dto.js';
import type { AllTransferRecommendationsQueryDto } from './dto/all-transfer-recommendations-query.dto.js';
import {
  buildAllBranchTransferRecommendations,
  buildProductBranchAnalysis,
  buildTransferRecommendations,
  type BranchTransferProductStat,
  type TransferProductStat,
} from './analysis/transfer-recommendation.js';

const MILLISECONDS_PER_DAY = 86_400_000;
const CURRENT_PERIOD_CACHE_MS = 5 * 60_000;
const CLOSED_PERIOD_CACHE_MS = 24 * 60 * 60_000;
const MAX_PERIOD_DAYS = 366;
const MAX_RECOMMENDATION_DATA_AGE_DAYS = 4;
const GENERAL_ORGANIZATION_BRANCH_NAMES = new Set([
  'ChP YATT - Toshkent',
  'Mitti Olam',
  'Ёшлар матбуоти',
  'Янги Аср Авлоди',
]);

type BranchSummaryItem = {
  id: string;
  name: string;
  entityType: 'retailStore' | 'organization';
  hasProductDetails: boolean;
  organization: {
    id: string;
    name: string;
  };
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
    private readonly companiesService: CompaniesService,
    @InjectModel(SalesSummaryCache.name)
    private readonly salesSummaryCacheModel: Model<SalesSummaryCacheDocument>,

    @InjectModel(BranchSalesPlan.name)
    private readonly branchSalesPlanModel: Model<BranchSalesPlanDocument>,

    @InjectModel(BranchProductStat.name)
    private readonly branchProductStatModel: Model<BranchProductStat>,
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

  async getBranchProducts(branchId: string, query: BranchProductsQueryDto) {
    const [branch] = await this.moyskladSyncService.getRetailStoresByIds([
      branchId,
    ]);

    if (!branch) {
      throw new NotFoundException('Filial topilmadi yoki ombori mavjud emas');
    }

    const normalizedSearch = query.search?.trim().toLocaleLowerCase('uz');
    const conditions: QueryFilter<BranchProductStat>[] = [
      {
        retailStoreId: branchId,
        isActive: true,
        available: { $gt: 0 },
      },
    ];

    if (normalizedSearch) {
      const escapedSearch = normalizedSearch.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      const expression = new RegExp(escapedSearch, 'i');

      conditions.push({
        $or: [
          { productName: expression },
          { code: expression },
          { article: expression },
        ],
      });
    }

    const filter = query.filter ?? BranchProductFilter.ALL;

    if (filter === BranchProductFilter.STALE) {
      const staleDays = query.staleDays ?? 90;
      const cutoff = new Date(Date.now() - staleDays * 86_400_000);

      conditions.push({
        $or: [{ lastSoldAt: null }, { lastSoldAt: { $lt: cutoff } }],
      });
    } else if (filter === BranchProductFilter.NEVER_SOLD) {
      conditions.push({ lastSoldAt: null });
    }

    const mongoFilter: QueryFilter<BranchProductStat> = {
      $and: conditions,
    };

    const sort = query.sort ?? BranchProductSort.STOCK_DESC;
    let sortBy: Record<string, SortOrder>;

    switch (sort) {
      case BranchProductSort.STOCK_ASC:
        sortBy = { available: 1, productName: 1 };
        break;
      case BranchProductSort.NAME_ASC:
        sortBy = { productName: 1 };
        break;
      case BranchProductSort.SALES_DESC:
        sortBy = { soldQuantity90Days: -1, productName: 1 };
        break;
      case BranchProductSort.LAST_SOLD_ASC:
        sortBy = { lastSoldAt: 1, productName: 1 };
        break;
      case BranchProductSort.STOCK_DESC:
      default:
        sortBy = { available: -1, productName: 1 };
        break;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const [items, total, summary, latest] = await Promise.all([
      this.branchProductStatModel
        .find(mongoFilter)
        .select({
          _id: 0,
          productId: 1,
          productName: 1,
          code: 1,
          article: 1,
          stock: 1,
          available: 1,
          inTransit: 1,
          lastSoldAt: 1,
          lastReceivedAt: 1,
          soldQuantity30Days: 1,
          soldQuantity90Days: 1,
        })
        .sort(sortBy)
        .skip(offset)
        .limit(limit)
        .lean()
        .exec(),
      this.branchProductStatModel.countDocuments(mongoFilter).exec(),
      this.branchProductStatModel
        .aggregate<{
          productCount: number;
          totalAvailable: number;
          noSales90DaysCount: number;
        }>([
          {
            $match: {
              retailStoreId: branchId,
              isActive: true,
              available: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              productCount: { $sum: 1 },
              totalAvailable: { $sum: '$available' },
              noSales90DaysCount: {
                $sum: {
                  $cond: [{ $eq: ['$lastSoldAt', null] }, 1, 0],
                },
              },
            },
          },
        ])
        .then((rows) => rows[0]),
      this.branchProductStatModel
        .findOne({ retailStoreId: branchId, isActive: true })
        .select({ _id: 0, syncedAt: 1 })
        .sort({ syncedAt: -1 })
        .lean()
        .exec(),
    ]);

    return {
      branch: {
        id: branch.moyskladId,
        name: branch.name,
      },
      summary: summary ?? {
        productCount: 0,
        totalAvailable: 0,
        noSales90DaysCount: 0,
      },
      syncedAt: latest?.syncedAt ?? null,
      items: items.map((item) => ({
        id: item.productId,
        name: item.productName,
        code: item.code,
        article: item.article,
        stock: item.stock,
        available: item.available,
        inTransit: item.inTransit,
        lastSoldAt: item.lastSoldAt,
        lastReceivedAt: item.lastReceivedAt,
        soldQuantity30Days: item.soldQuantity30Days,
        soldQuantity90Days: item.soldQuantity90Days,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductBranchAnalysis(branchId: string, productId: string) {
    const branches = await this.moyskladSyncService.getAllActiveRetailStores();
    const branchById = new Map(
      branches.map((branch) => [branch.moyskladId, branch]),
    );
    const currentBranch = branchById.get(branchId);

    if (!currentBranch) {
      throw new NotFoundException('Filial topilmadi yoki faol emas');
    }

    const stats = await this.branchProductStatModel
      .find({
        productId,
        isActive: true,
        retailStoreId: { $in: branches.map((branch) => branch.moyskladId) },
      })
      .select({
        _id: 0,
        retailStoreId: 1,
        productId: 1,
        productName: 1,
        code: 1,
        article: 1,
        stock: 1,
        available: 1,
        inTransit: 1,
        soldQuantity30Days: 1,
        soldQuantity90Days: 1,
        syncedAt: 1,
      })
      .lean()
      .exec();

    if (stats.length === 0) {
      throw new NotFoundException(
        'Mahsulotning filiallar bo‘yicha sync statistikasi topilmadi',
      );
    }

    const statByBranchId = new Map(
      stats.map((stat) => [stat.retailStoreId, stat]),
    );
    const currentStat = statByBranchId.get(branchId);

    if (!currentStat) {
      throw new NotFoundException(
        'Mahsulot tanlangan filial statistikalarida topilmadi',
      );
    }

    const staleCutoff = new Date(
      Date.now() - MAX_RECOMMENDATION_DATA_AGE_DAYS * MILLISECONDS_PER_DAY,
    );

    if (currentStat.syncedAt < staleCutoff) {
      throw new ConflictException({
        message:
          'Tanlangan filial ma’lumotlari eskirgan; avval filial mahsulotlarini sync qiling',
        syncedAt: currentStat.syncedAt,
      });
    }

    const freshStats: BranchTransferProductStat[] = stats
      .filter((stat) => stat.syncedAt >= staleCutoff)
      .map((stat) => ({
        retailStoreId: stat.retailStoreId,
        productId: stat.productId,
        productName: stat.productName,
        code: stat.code,
        article: stat.article,
        available: stat.available,
        reserve: Math.max(stat.stock - stat.available, 0),
        inTransit: stat.inTransit,
        soldQuantity30Days: stat.soldQuantity30Days,
        soldQuantity90Days: stat.soldQuantity90Days,
        syncedAt: stat.syncedAt,
      }));
    const analysis = buildProductBranchAnalysis(freshStats, branchId);
    const branchRanking = analysis.branches.map((branch) => ({
      id: branch.branchId,
      name: branchById.get(branch.branchId)?.name ?? branch.branchId,
      available: branch.available,
      inTransit: branch.inTransit,
      soldQuantity30Days: branch.soldQuantity30Days,
      soldQuantity90Days: branch.soldQuantity90Days,
      dailyVelocity: branch.dailyVelocity,
      syncedAt: branch.syncedAt,
      rank: branch.rank,
      isCurrentBranch: branch.isCurrentBranch,
    }));
    const currentBranchAnalysis = branchRanking.find(
      (branch) => branch.id === branchId,
    );

    if (!currentBranchAnalysis) {
      throw new ConflictException(
        'Tanlangan filialning yangi mahsulot statistikasi topilmadi',
      );
    }
    const bestSellingBranch =
      branchRanking.find(
        (branch) => branch.id === analysis.bestSellingBranchId,
      ) ?? null;
    const recommendation =
      bestSellingBranch &&
      bestSellingBranch.id !== branchId &&
      bestSellingBranch.dailyVelocity > currentBranchAnalysis.dailyVelocity
        ? {
            branch: bestSellingBranch,
            velocityRatio: analysis.velocityRatio,
            reason:
              analysis.velocityRatio !== null
                ? `So‘nggi 30/90 kunlik savdo bo‘yicha ${bestSellingBranch.name} filialida mahsulot tezligi ${analysis.velocityRatio} baravar yuqori.`
                : `${currentBranch.name} filialida so‘nggi 30 kunda sotuv qayd etilmagan; ${bestSellingBranch.name} filialida ${bestSellingBranch.soldQuantity30Days} dona sotilgan.`,
          }
        : null;
    const excludedBranches = branches
      .filter((branch) => {
        const stat = statByBranchId.get(branch.moyskladId);
        return !stat || stat.syncedAt < staleCutoff;
      })
      .map((branch) => {
        const stat = statByBranchId.get(branch.moyskladId);

        return {
          id: branch.moyskladId,
          name: branch.name,
          syncedAt: stat?.syncedAt ?? null,
          reason: stat
            ? 'Mahsulot ma’lumoti 4 kundan eski'
            : 'Mahsulot bu filial sync ma’lumotlarida topilmadi',
        };
      });

    return {
      mode: 'read_only' as const,
      analyzedAt: new Date(),
      product: {
        id: currentStat.productId,
        name: currentStat.productName,
        code: currentStat.code,
        article: currentStat.article,
      },
      currentBranch: {
        ...currentBranchAnalysis,
        id: currentBranch.moyskladId,
        name: currentBranch.name,
      },
      bestSellingBranch,
      recommendation,
      branchRanking,
      analyzedBranchCount: branchRanking.length,
      excludedBranches,
    };
  }

  async getTransferRecommendations(query: TransferRecommendationsQueryDto) {
    if (query.sourceBranchId === query.targetBranchId) {
      throw new BadRequestException(
        'Manba va qabul qiluvchi filial bir xil bo‘lishi mumkin emas',
      );
    }

    const branches = await this.moyskladSyncService.getRetailStoresByIds([
      query.sourceBranchId,
      query.targetBranchId,
    ]);
    const branchById = new Map(
      branches.map((branch) => [branch.moyskladId, branch]),
    );
    const sourceBranch = branchById.get(query.sourceBranchId);
    const targetBranch = branchById.get(query.targetBranchId);

    if (!sourceBranch || !targetBranch) {
      throw new NotFoundException('Manba yoki qabul qiluvchi filial topilmadi');
    }

    const projection = {
      _id: 0,
      productId: 1,
      productName: 1,
      code: 1,
      article: 1,
      stock: 1,
      available: 1,
      inTransit: 1,
      soldQuantity30Days: 1,
      soldQuantity90Days: 1,
      syncedAt: 1,
    };
    const [sourceStats, targetStats] = await Promise.all([
      this.branchProductStatModel
        .find({ retailStoreId: query.sourceBranchId, isActive: true })
        .select(projection)
        .lean()
        .exec(),
      this.branchProductStatModel
        .find({ retailStoreId: query.targetBranchId, isActive: true })
        .select(projection)
        .lean()
        .exec(),
    ]);

    if (sourceStats.length === 0 || targetStats.length === 0) {
      throw new ConflictException(
        'Filial mahsulotlari hali to‘liq sync qilinmagan',
      );
    }

    const oldestSyncAt = [...sourceStats, ...targetStats].reduce(
      (oldest, stat) => (stat.syncedAt < oldest ? stat.syncedAt : oldest),
      new Date(),
    );
    const staleCutoff = new Date(
      Date.now() - MAX_RECOMMENDATION_DATA_AGE_DAYS * MILLISECONDS_PER_DAY,
    );

    if (oldestSyncAt < staleCutoff) {
      throw new ConflictException({
        message:
          'Tavsiya uchun filial ma’lumotlari eskirgan; avval ikkala filialni sync qiling',
        oldestSyncAt,
      });
    }

    const rules = {
      minTargetSales30Days: query.minTargetSales30Days ?? 5,
      minVelocityRatio: query.minVelocityRatio ?? 2,
      targetCoverDays: query.targetCoverDays ?? 30,
      sourceSafetyDays: query.sourceSafetyDays ?? 30,
      maxTransferQuantity: query.maxTransferQuantity ?? 100,
    };
    const normalizeStats = (stats: typeof sourceStats): TransferProductStat[] =>
      stats.map((stat) => ({
        productId: stat.productId,
        productName: stat.productName,
        code: stat.code,
        article: stat.article,
        available: stat.available,
        reserve: Math.max(stat.stock - stat.available, 0),
        inTransit: stat.inTransit,
        soldQuantity30Days: stat.soldQuantity30Days,
        soldQuantity90Days: stat.soldQuantity90Days,
        syncedAt: stat.syncedAt,
      }));
    const recommendations = buildTransferRecommendations(
      normalizeStats(sourceStats),
      normalizeStats(targetStats),
      rules,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    return {
      mode: 'read_only' as const,
      sourceBranch: {
        id: sourceBranch.moyskladId,
        name: sourceBranch.name,
      },
      targetBranch: {
        id: targetBranch.moyskladId,
        name: targetBranch.name,
      },
      calculatedAt: new Date(),
      oldestSyncAt,
      rules,
      items: recommendations.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: recommendations.length,
        totalPages: Math.ceil(recommendations.length / limit),
      },
    };
  }

  async getAllTransferRecommendations(
    query: AllTransferRecommendationsQueryDto,
  ) {
    const projection = {
      _id: 0,
      retailStoreId: 1,
      productId: 1,
      productName: 1,
      code: 1,
      article: 1,
      stock: 1,
      available: 1,
      inTransit: 1,
      soldQuantity30Days: 1,
      soldQuantity90Days: 1,
      syncedAt: 1,
    };
    const allStats = await this.branchProductStatModel
      .find({ isActive: true })
      .select(projection)
      .lean()
      .exec();

    if (allStats.length === 0) {
      throw new ConflictException(
        'Filial mahsulotlari hali to‘liq sync qilinmagan',
      );
    }

    const oldestSyncByBranchId = new Map<string, Date>();

    for (const stat of allStats) {
      const current = oldestSyncByBranchId.get(stat.retailStoreId);

      if (!current || stat.syncedAt < current) {
        oldestSyncByBranchId.set(stat.retailStoreId, stat.syncedAt);
      }
    }

    const branches = await this.moyskladSyncService.getAllActiveRetailStores();
    const branchIds = branches.map((branch) => branch.moyskladId);
    const branchById = new Map(
      branches.map((branch) => [branch.moyskladId, branch]),
    );
    const staleCutoff = new Date(
      Date.now() - MAX_RECOMMENDATION_DATA_AGE_DAYS * MILLISECONDS_PER_DAY,
    );
    const freshBranchIds = new Set(
      branchIds.filter((branchId) => {
        const syncedAt = oldestSyncByBranchId.get(branchId);
        return Boolean(
          branchById.has(branchId) && syncedAt && syncedAt >= staleCutoff,
        );
      }),
    );

    if (freshBranchIds.size < 2) {
      throw new ConflictException(
        'Umumiy tahlil uchun kamida ikkita yangi sync qilingan filial kerak',
      );
    }

    const rules = {
      minTargetSales30Days: query.minTargetSales30Days ?? 5,
      minVelocityRatio: query.minVelocityRatio ?? 2,
      targetCoverDays: query.targetCoverDays ?? 30,
      sourceSafetyDays: query.sourceSafetyDays ?? 30,
      maxTransferQuantity: query.maxTransferQuantity ?? 100,
    };
    const normalizedStats: BranchTransferProductStat[] = allStats
      .filter((stat) => freshBranchIds.has(stat.retailStoreId))
      .map((stat) => ({
        retailStoreId: stat.retailStoreId,
        productId: stat.productId,
        productName: stat.productName,
        code: stat.code,
        article: stat.article,
        available: stat.available,
        reserve: Math.max(stat.stock - stat.available, 0),
        inTransit: stat.inTransit,
        soldQuantity30Days: stat.soldQuantity30Days,
        soldQuantity90Days: stat.soldQuantity90Days,
        syncedAt: stat.syncedAt,
      }));
    const recommendations = buildAllBranchTransferRecommendations(
      normalizedStats,
      rules,
    ).map((recommendation) => ({
      ...recommendation,
      sourceBranch: {
        id: recommendation.sourceBranchId,
        name:
          branchById.get(recommendation.sourceBranchId)?.name ??
          recommendation.sourceBranchId,
      },
      targetBranch: {
        id: recommendation.targetBranchId,
        name:
          branchById.get(recommendation.targetBranchId)?.name ??
          recommendation.targetBranchId,
      },
    }));
    const excludedBranches = branchIds
      .filter((branchId) => !freshBranchIds.has(branchId))
      .map((branchId) => ({
        id: branchId,
        name: branchById.get(branchId)?.name ?? branchId,
        oldestSyncAt: oldestSyncByBranchId.get(branchId) ?? null,
        reason: oldestSyncByBranchId.has(branchId)
          ? 'Ma’lumot 4 kundan eski'
          : 'Filial mahsulotlari sync qilinmagan',
      }));
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    return {
      mode: 'read_only' as const,
      scope: 'all_fresh_branches' as const,
      calculatedAt: new Date(),
      analyzedBranchCount: freshBranchIds.size,
      excludedBranches,
      rules,
      items: recommendations.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: recommendations.length,
        totalPages: Math.ceil(recommendations.length / limit),
      },
    };
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
    let selectedOrganizationIds: Set<string> | undefined;

    if (query.companyId) {
      const company = await this.companiesService.getCompanyById(
        query.companyId,
      );

      const organizationIds = company.moyskladOrganizationIds ?? [];

      if (organizationIds.length === 0) {
        throw new BadRequestException(
          'Kompaniyaga MoySklad tashkilotlari biriktirilmagan',
        );
      }

      selectedOrganizationIds = new Set(organizationIds);
    }

    const [totals, plans, stores, organizations] = await Promise.all([
      this.moyskladSyncService.getBranchPeriodTotals(query.from, query.to),
      this.branchSalesPlanModel.find({ month }).lean().exec(),
      this.moyskladClient.listAllRetailStores(),
      this.moyskladClient.listAllOrganizations(),
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

    const resultByStoreId = new Map(
      totals.map((total) => [total.retailStoreId, getResultMinor(total)]),
    );

    const planByStoreId = new Map(
      plans.map((plan) => [plan.retailStoreId, plan.amount]),
    );

    const filteredStores = selectedOrganizationIds
      ? stores.filter((store) =>
          selectedOrganizationIds.has(store.organization.id),
        )
      : stores;

    const retailStoreBranches = filteredStores.map((store) => ({
      id: store.id,
      name: store.name,
      entityType: 'retailStore' as const,
      hasProductDetails: Boolean(store.store?.meta.href),
      organization: {
        id: store.organization.id,
        name: store.organization.name,
      },
      monthlyPlan: planByStoreId.get(store.id) ?? 0,
      result: Number(((resultByStoreId.get(store.id) ?? 0) / 100).toFixed(2)),
    }));

    const organizationIdsWithStores = new Set(
      filteredStores.map((store) => store.organization.id),
    );

    const organizationOnlyBranches = organizations
      .filter((organization) => {
        const shouldInclude = selectedOrganizationIds
          ? selectedOrganizationIds.has(organization.id)
          : GENERAL_ORGANIZATION_BRANCH_NAMES.has(organization.name);

        return shouldInclude && !organizationIdsWithStores.has(organization.id);
      })
      .map((organization) => ({
        id: organization.id,
        name: organization.name,
        entityType: 'organization' as const,
        hasProductDetails: false,
        organization: {
          id: organization.id,
          name: organization.name,
        },
        monthlyPlan: planByStoreId.get(organization.id) ?? 0,
        result: 0,
      }));

    return [...retailStoreBranches, ...organizationOnlyBranches];
    // return retailStoreBranches.filter((branch) => branch.result !== 0);
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
