import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RolesService } from '../roles/roles.service.js';
import { RoleScope } from '../roles/enum/role-scope.enum.js';
import { CompaniesService } from '../companies/companies.service.js';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../users/schemas/user.schema.js';

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

  const companiesServiceMock = {
    findActiveCompanyById: vi.fn(),
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
        {
          provide: CompaniesService,
          useValue: companiesServiceMock,
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

    const result = await service.getTokens('user-id', 'admin', 'role-id', null);

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

  it('should login an active employee only for the selected company', async () => {
    const password = 'secret123';
    const company = {
      id: 'company-id',
      companyName: 'Demo Company',
    };
    const user = {
      id: 'user-id',
      companyId: company.id,
      roleId: 'role-id',
      name: 'Ali',
      middleName: 'Valiyev',
      login: 'ali',
      password: await bcrypt.hash(password, 4),
      phone: '+998901234567',
      status: UserStatus.ACTIVE,
    };

    companiesServiceMock.findActiveCompanyById.mockResolvedValue(company);
    usersServiceMock.findByLogin.mockResolvedValue(user);
    rolesServiceMock.findRoleForAuth.mockResolvedValue({
      isActive: true,
      permissions: [],
      roleName: 'Employee',
      scope: RoleScope.COMPANY,
    });
    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.login({
      companyId: company.id,
      login: 'ALI',
      password,
    });

    expect(usersServiceMock.findByLogin).toHaveBeenCalledWith('ali');
    expect(result.company).toEqual(company);
    expect(result.employee).toEqual(
      expect.objectContaining({
        id: user.id,
        companyId: company.id,
        login: user.login,
      }),
    );
    expect(result.employee).not.toHaveProperty('password');
    expect(usersServiceMock.updateRefreshToken).toHaveBeenCalledWith(
      user.id,
      'refresh-token',
    );
  });

  it('should reject an employee of another company after password validation', async () => {
    const password = 'secret123';

    companiesServiceMock.findActiveCompanyById.mockResolvedValue({
      id: 'selected-company-id',
    });
    usersServiceMock.findByLogin.mockResolvedValue({
      id: 'user-id',
      companyId: 'another-company-id',
      roleId: 'role-id',
      login: 'ali',
      password: await bcrypt.hash(password, 4),
      status: UserStatus.ACTIVE,
    });
    rolesServiceMock.findRoleForAuth.mockResolvedValue({
      isActive: true,
      permissions: [],
      roleName: 'Employee',
      scope: RoleScope.COMPANY,
    });

    await expect(
      service.login({
        companyId: 'selected-company-id',
        login: 'ali',
        password,
      }),
    ).rejects.toEqual(
      new ForbiddenException('Siz tanlangan kompaniya xodimi emassiz'),
    );

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
