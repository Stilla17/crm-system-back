import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

describe('RolesController', () => {
  let controller: RolesController;

  const rolesServiceMock = {
    createRole: vi.fn(),
    getAllRoles: vi.fn(),
    getRoleById: vi.fn(),
    updateRole: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: rolesServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
