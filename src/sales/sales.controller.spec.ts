import { Test, TestingModule } from '@nestjs/testing';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';

describe('SalesController', () => {
  let controller: SalesController;

  beforeEach(async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [SalesController],
        providers: [
          {
            provide: SalesService,
            useValue: {
              getSummary: async () => ({}),
              getProductBranchAnalysis: async (
                branchId: string,
                productId: string,
              ) => ({ branchId, productId }),
            },
          },
        ],
      }).compile();

    controller =
      module.get<SalesController>(SalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the selected branch and product to the analysis service', async () => {
    await expect(
      controller.getProductBranchAnalysis('qarshi', 'product-1'),
    ).resolves.toEqual({
      branchId: 'qarshi',
      productId: 'product-1',
    });
  });
});