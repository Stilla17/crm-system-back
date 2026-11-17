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
});