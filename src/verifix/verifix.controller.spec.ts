import { Test, TestingModule } from '@nestjs/testing';
import { VerifixController } from './verifix.controller.js';
import { VerifixService } from './verifix.service.js';

describe('VerifixController', () => {
  let controller: VerifixController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerifixController],
      providers: [
        {
          provide: VerifixService,
          useValue: {
            listEmployees: vi.fn(),
            listTracks: vi.fn(),
            listLocations: vi.fn(),
            listJobs: vi.fn(),
            listDivisions: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(VerifixController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});