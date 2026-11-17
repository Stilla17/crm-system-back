import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MoyskladClient } from '../moysklad/moysklad.client.js';
import { SalesService } from './sales.service.js';
import { SalesSummaryCache } from './schemas/sales-summary-cache.schema.js';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
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
          provide: getModelToken(SalesSummaryCache.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
