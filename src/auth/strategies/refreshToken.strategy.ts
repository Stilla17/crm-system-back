import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

// Token ichidagi payload tipi
interface JwtPayload {
  sub: string;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      // Tokenni Request Header'dan (Authorization: Bearer <token>) oladi
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request.cookies?.refreshToken ?? null,
      ]),
      // Tokenni tekshirish uchun maxfiy kalit (.env dan olinadi)
      secretOrKey: process.env.JWT_REFRESH_SECRET!,
      // requestni validate methodiga yuboradi, shunda userni tekshirish mumkin bo'ladi
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();
    return {
      ...payload,
      refreshToken: req.cookies?.refreshToken ?? refreshToken,
    };
  }
}
