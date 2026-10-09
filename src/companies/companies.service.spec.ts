import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CompaniesService } from './companies.service.js';
import { Company } from './schemas/company.schema.js';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const companyModelMock = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: getModelToken(Company.name),
          useValue: companyModelMock,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
