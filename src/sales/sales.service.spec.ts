import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MoyskladClient } from '../moysklad/moysklad.client.js';
import { MoyskladSyncService } from '../moysklad-sync/moysklad-sync.service.js';
import { BranchProductStat } from '../moysklad-sync/schema/branch-product-stat.schema.js';
import { CompaniesService } from '../companies/companies.service.js';
import { SalesService } from './sales.service.js';
import { BranchSalesPlan } from './schemas/branch-sales-plan.schema.js';
import { SalesSummaryCache } from './schemas/sales-summary-cache.schema.js';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const syncedAt = new Date();
    const productStats = [
      {
        retailStoreId: 'qarshi',
        productId: 'product-1',
        productName: 'Test kitob',
        stock: 40,
        available: 40,
        inTransit: 0,
        soldQuantity30Days: 2,
        soldQuantity90Days: 6,
        syncedAt,
      },
      {
        retailStoreId: 'navoiy',
        productId: 'product-1',
        productName: 'Test kitob',
        stock: 3,
        available: 3,
        inTransit: 0,
        soldQuantity30Days: 20,
        soldQuantity90Days: 45,
        syncedAt,
      },
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: MoyskladClient,
          useValue: {
            summarizeDocuments: async () => ({
              amount: 0,
              count: 0,
            }),
          },
        },
        {
          provide: MoyskladSyncService,
          useValue: {
            getRetailStoresByIds: async (ids: string[]) =>
              ids.map((moyskladId) => ({
                moyskladId,
                name: moyskladId === 'qarshi' ? 'Qarshi' : 'Navoiy',
              })),
            getAllActiveRetailStores: async () => [
              { moyskladId: 'qarshi', name: 'Qarshi' },
              { moyskladId: 'navoiy', name: 'Navoiy' },
            ],
          },
        },
        {
          provide: CompaniesService,
          useValue: {},
        },
        {
          provide: getModelToken(SalesSummaryCache.name),
          useValue: {},
        },
        {
          provide: getModelToken(BranchSalesPlan.name),
          useValue: {},
        },
        {
          provide: getModelToken(BranchProductStat.name),
          useValue: {
            find: (filter: {
              productId?: string;
              retailStoreId?: string | { $in: string[] };
            }) => ({
              select: () => ({
                lean: () => ({
                  exec: async () =>
                    productStats.filter((stat) => {
                      const storeFilter = filter.retailStoreId;
                      const matchesStore =
                        typeof storeFilter === 'string'
                          ? stat.retailStoreId === storeFilter
                          : !storeFilter ||
                            storeFilter.$in.includes(stat.retailStoreId);

                      return (
                        matchesStore &&
                        (!filter.productId ||
                          stat.productId === filter.productId)
                      );
                    }),
                }),
              }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('recommends moving slow-selling stock from Qarshi to Navoiy', async () => {
    const response = await service.getTransferRecommendations({
      sourceBranchId: 'qarshi',
      targetBranchId: 'navoiy',
    });

    expect(response.items[0]).toMatchObject({
      productId: 'product-1',
      suggestedQuantity: 16,
    });
    expect(response.sourceBranch.name).toBe('Qarshi');
    expect(response.targetBranch.name).toBe('Navoiy');
  });

  it('analyzes the selected product across branches and suggests its best-selling branch', async () => {
    const response = await service.getProductBranchAnalysis(
      'qarshi',
      'product-1',
    );

    expect(response.currentBranch).toMatchObject({
      id: 'qarshi',
      name: 'Qarshi',
      rank: 2,
    });
    expect(response.bestSellingBranch).toMatchObject({
      id: 'navoiy',
      name: 'Navoiy',
      soldQuantity30Days: 20,
      rank: 1,
    });
    expect(response.recommendation).toMatchObject({
      velocityRatio: 9.25,
    });
  });
});
