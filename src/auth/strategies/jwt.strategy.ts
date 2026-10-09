import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import type { Request } from 'express';
import { RolesService } from '../../roles/roles.service.js';
import { UserStatus } from '../../users/schemas/user.schema.js';
import { RoleScope } from '../../roles/enum/role-scope.enum.js';

// Token ichidagi payload tipi
interface JwtPayload {
  sub: string;
  login: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {
    super({
      // Tokenni Request Header'dan (Authorization: Bearer <token>) oladi
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request.cookies?.accessToken ?? null,
      ]),
      // Tokenni tekshirish uchun maxfiy kalit (.env dan olinadi)
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.getUserById(payload.sub);

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User faol emas');
    }

    const role = await this.rolesService.findRoleForAuth(user.roleId);

    if (!role) {
      throw new UnauthorizedException('User role topilmadi');
    }

    if (!role.isActive) {
      throw new UnauthorizedException('User role faol emas');
    }

    if (role.scope === RoleScope.COMPANY) {
      if (!user.companyId) {
        throw new UnauthorizedException('Company userda companyId mavjud emas');
      }

      if (role.companyId !== user.companyId) {
        throw new UnauthorizedException('User va role kompaniyasi mos emas');
      }
    }

    if (role.scope === RoleScope.SYSTEM && user.companyId !== null) {
      throw new UnauthorizedException(
        'System user kompaniyaga biriktirilmasligi kerak',
      );
    }

    return {
      id: user.id,
      login: user.login,
      companyId: user.companyId,
      roleId: user.roleId,
      roleName: role.roleName,
      roleScope: role.scope,
      permissions: role.permissions,
    };
  }
}
