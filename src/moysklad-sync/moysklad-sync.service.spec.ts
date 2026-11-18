import { Test, TestingModule } from '@nestjs/testing';
import { MoyskladSyncService } from './moysklad-sync.service.js';

describe('MoyskladSyncService', () => {
  let service: MoyskladSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MoyskladSyncService],
    }).compile();

    service = module.get<MoyskladSyncService>(MoyskladSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
