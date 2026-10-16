import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RolesService } from '../roles/roles.service.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    findByLogin: vi.fn(),
    getUserByIdWithRefreshToken: vi.fn(),
    updateRefreshToken: vi.fn(),
  };

  const jwtServiceMock = {
    signAsync: vi.fn(),
  };

  const rolesServiceMock = {
    findRoleForAuth: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: RolesService,
          useValue: rolesServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should include authorization claims in generated tokens', async () => {
    rolesServiceMock.findRoleForAuth.mockResolvedValue({
      isActive: true,
      permissions: ['companies.read', 'users.read'],
      roleName: 'Super Admin',
      scope: RoleScope.SYSTEM,
    });
    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.getTokens(
      'user-id',
      'admin',
      'role-id',
      null,
    );

    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: null,
        isSystemUser: true,
        permissions: ['companies.read', 'users.read'],
        roleId: 'role-id',
        roleName: 'Super Admin',
        roleScope: RoleScope.SYSTEM,
      }),
      expect.objectContaining({
        secret: process.env.JWT_ACCESS_SECRET,
      }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });
});
