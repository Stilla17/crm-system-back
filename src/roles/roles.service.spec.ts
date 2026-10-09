import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RolesService } from './roles.service.js';
import { Role } from './schemas/role.schema.js';

describe('RolesService', () => {
  let service: RolesService;

  const roleModelMock = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: getModelToken(Role.name),
          useValue: roleModelMock,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
