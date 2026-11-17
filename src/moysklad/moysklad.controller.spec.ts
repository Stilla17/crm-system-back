import { Test, TestingModule } from '@nestjs/testing';
import { MoyskladController } from './moysklad.controller.js';

describe('MoyskladController', () => {
  let controller: MoyskladController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoyskladController],
    }).compile();

    controller = module.get<MoyskladController>(MoyskladController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
