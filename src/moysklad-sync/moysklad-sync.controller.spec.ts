import { Test, TestingModule } from '@nestjs/testing';
import { MoyskladSyncController } from './moysklad-sync.controller.js';

describe('MoyskladSyncController', () => {
  let controller: MoyskladSyncController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoyskladSyncController],
    }).compile();

    controller = module.get<MoyskladSyncController>(MoyskladSyncController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
