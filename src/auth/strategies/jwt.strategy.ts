import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import type { Request } from 'express';

// Token ichidagi payload tipi
interface JwtPayload {
  sub: string;
  login: string;
  roleName: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
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

    return {
      id: user.id,
      login: user.login,
      roleName: user.roleName,
      permissions: user.permissions,
    };
  }
}
