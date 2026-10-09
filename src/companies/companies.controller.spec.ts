import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

describe('CompaniesController', () => {
  let controller: CompaniesController;

  const companiesServiceMock = {
    getAllCompanies: vi.fn(),
    getCompanyById: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),
    deleteCompany: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: companiesServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
